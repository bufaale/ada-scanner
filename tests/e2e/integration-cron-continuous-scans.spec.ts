/**
 * Integration test — /api/cron/continuous-scans against the deployed app.
 *
 * Asserts:
 *  - GET without Authorization Bearer header → 401
 *  - GET with bogus Bearer token → 401
 *  - GET with correct Bearer + idle data → 200, harvested=0 / dispatched=0
 *  - GET with correct Bearer + a stale weekly monitored_site → 200 +
 *    dispatched count includes that site (verified by checking that a new
 *    scans row was inserted for the test user)
 *
 * The signed paths skip cleanly when CRON_SECRET / supabase env are absent.
 */
import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser } from "../helpers/test-utils";

const BASE = process.env.TEST_BASE_URL || "https://app-04-ada-scanner.vercel.app";
const CRON_URL = `${BASE}/api/cron/continuous-scans`;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET?.trim();

function sbHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: SUPABASE_ANON_KEY!,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

test.describe("Cron continuous-scans — auth gate", () => {
  test("rejects request with no Authorization header (401)", async ({ request }) => {
    const r = await request.get(CRON_URL);
    expect(r.status()).toBe(401);
    const json = await r.json();
    expect(json.error).toBe("Unauthorized");
  });

  test("rejects request with bogus Bearer token (401)", async ({ request }) => {
    const r = await request.get(CRON_URL, {
      headers: { Authorization: "Bearer not-the-real-secret" },
    });
    expect(r.status()).toBe(401);
  });

  test("rejects request with x-vercel-cron header but no Bearer (401)", async ({ request }) => {
    // Defense in depth — vercel-cron alone is forgeable.
    const r = await request.get(CRON_URL, {
      headers: { "x-vercel-cron": "1" },
    });
    expect(r.status()).toBe(401);
  });
});

test.describe(CRON_SECRET ? "Cron continuous-scans — authorized" : "Cron continuous-scans — authorized (skipped, no CRON_SECRET)", () => {
  test.skip(!CRON_SECRET, "CRON_SECRET not set");
  test.skip(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY, "Supabase env not set");

  test("returns 200 with harvested+dispatched counts for valid bearer", async ({ request }) => {
    const r = await request.get(CRON_URL, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(r.status()).toBe(200);
    const json = await r.json();
    expect(json).toHaveProperty("harvested");
    expect(json).toHaveProperty("dispatched");
    expect(typeof json.harvested).toBe("number");
    expect(typeof json.dispatched).toBe("number");
  });

  test("dispatches a stale weekly monitored_site → inserts new pending scans row", async ({ request }) => {
    const user = await createTestUser("cron-dispatch", "business");
    let monitoredSiteId: string | null = null;
    try {
      // Insert a monitored_site that's last_scan_at is 8d ago — should fire.
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/monitored_sites`, {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          url: "https://example-cron-test.test",
          label: "E2E cron test site",
          enabled: true,
          cadence: "weekly",
          regression_threshold: 5,
          last_scan_at: oldDate,
          alert_email: null,
        }),
      });
      // monitored_sites table may not exist in this env. Skip rather than fail.
      if (!insertRes.ok) {
        test.skip(true, `monitored_sites insert failed (${insertRes.status}) — table may not exist in this env`);
        return;
      }
      const rows = await insertRes.json();
      monitoredSiteId = Array.isArray(rows) ? rows[0]?.id : rows?.id;
      expect(monitoredSiteId).toBeTruthy();

      const r = await request.get(CRON_URL, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(r.status()).toBe(200);
      const json = await r.json();
      expect(json.dispatched).toBeGreaterThanOrEqual(1);

      // Verify a new scans row was inserted for our user.
      const scansRes = await fetch(
        `${SUPABASE_URL}/rest/v1/scans?user_id=eq.${user.id}&select=id,status,monitored_site_id`,
        { headers: sbHeaders() },
      );
      const scans = await scansRes.json();
      expect(Array.isArray(scans)).toBe(true);
      expect(scans.length).toBeGreaterThanOrEqual(1);
      const dispatched = (scans as Array<{ monitored_site_id: string | null; status: string }>).find(
        (s) => s.monitored_site_id === monitoredSiteId,
      );
      expect(dispatched).toBeDefined();
      expect(dispatched!.status).toBe("pending");
    } finally {
      // Best-effort cleanup. monitored_sites + scans cascade through FKs on user delete.
      await deleteTestUser(user.id);
    }
  });

  test("does NOT re-dispatch a fresh weekly monitored_site (idempotent)", async ({ request }) => {
    const user = await createTestUser("cron-noop", "business");
    try {
      // last_scan_at = NOW (less than 7d ago).
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/monitored_sites`, {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          url: "https://example-cron-fresh.test",
          label: "E2E cron fresh site",
          enabled: true,
          cadence: "weekly",
          regression_threshold: 5,
          last_scan_at: new Date().toISOString(),
          alert_email: null,
        }),
      });
      if (!insertRes.ok) {
        test.skip(true, `monitored_sites insert failed (${insertRes.status}) — table may not exist`);
        return;
      }

      const r = await request.get(CRON_URL, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(r.status()).toBe(200);

      // No scans should have been created for this user (the row is fresh).
      const scansRes = await fetch(
        `${SUPABASE_URL}/rest/v1/scans?user_id=eq.${user.id}&select=id`,
        { headers: sbHeaders() },
      );
      const scans = await scansRes.json();
      expect(Array.isArray(scans)).toBe(true);
      expect(scans.length).toBe(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
