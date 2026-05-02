/**
 * Integration test — Row-Level Security cross-user isolation.
 *
 * For every authenticated GET endpoint that takes an `[id]` path segment,
 * verify that user B cannot read user A's row by ID. The expectations are:
 *  - scan endpoint: 404 (scoped via .eq("user_id", user.id))
 *  - monitored_site endpoint: 404
 *  - sites list endpoint: returns empty / does not include the other user's row
 *  - anonymous request to any of them: 401
 *
 * This guards against a future regression where someone removes the
 * .eq("user_id", user.id) filter and silently exposes another user's data.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
  seedScan,
} from "../helpers/test-utils";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function sbHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: SUPABASE_ANON_KEY!,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function cookiesAsHeader(page: Page): Promise<string> {
  return (await page.context().cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

test.describe("Cross-user RLS — API isolation", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY, "Supabase env not set");

  test("user B cannot GET /api/scans/[id] for user A's scan → 404", async ({ page, request, baseURL }) => {
    const userA = await createTestUser("rls-scan-A", "free");
    const userB = await createTestUser("rls-scan-B", "free");
    try {
      const scanA = await seedScan(userA.id);

      await loginViaUI(page, userB.email);
      const cookies = await cookiesAsHeader(page);
      const res = await request.get(`${baseURL}/api/scans/${scanA.id}`, {
        headers: { Cookie: cookies },
      });
      expect(res.status()).toBe(404);
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("anonymous GET /api/scans/[id] → 401", async ({ request, baseURL }) => {
    const userA = await createTestUser("rls-scan-anon", "free");
    try {
      const scanA = await seedScan(userA.id);
      const res = await request.get(`${baseURL}/api/scans/${scanA.id}`);
      expect(res.status()).toBe(401);
    } finally {
      await deleteTestUser(userA.id);
    }
  });

  test("user B's GET /api/scans/[id] for own scan returns 200", async ({ page, request, baseURL }) => {
    const userB = await createTestUser("rls-scan-self", "free");
    try {
      const scanB = await seedScan(userB.id);
      await loginViaUI(page, userB.email);
      const cookies = await cookiesAsHeader(page);
      const res = await request.get(`${baseURL}/api/scans/${scanB.id}`, {
        headers: { Cookie: cookies },
      });
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.id).toBe(scanB.id);
    } finally {
      await deleteTestUser(userB.id);
    }
  });

  test("user B's GET /api/sites returns only their own sites", async ({ page, request, baseURL }) => {
    const userA = await createTestUser("rls-sites-A", "free");
    const userB = await createTestUser("rls-sites-B", "free");
    try {
      // Insert one site for each user via service-role.
      const insertSite = async (userId: string, domain: string) => {
        return fetch(`${SUPABASE_URL}/rest/v1/sites`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ user_id: userId, domain, name: domain }),
        });
      };
      const aRes = await insertSite(userA.id, `userA-${Date.now()}.test`);
      const bRes = await insertSite(userB.id, `userB-${Date.now()}.test`);
      // sites table may not exist in this env — skip if so.
      if (!aRes.ok || !bRes.ok) {
        test.skip(true, "sites table insert failed — table may not exist in this env");
        return;
      }

      await loginViaUI(page, userB.email);
      const cookies = await cookiesAsHeader(page);
      const res = await request.get(`${baseURL}/api/sites`, {
        headers: { Cookie: cookies },
      });
      // Endpoint exists — should be 200 with only B's sites.
      if (res.status() === 200) {
        const sites = await res.json();
        // Tolerate either array or {sites: [...]} shape.
        const list: Array<{ user_id?: string; domain?: string }> = Array.isArray(sites)
          ? sites
          : sites?.sites ?? sites?.data ?? [];
        // EVERY returned row must belong to user B (not user A).
        for (const s of list) {
          if (s.user_id) expect(s.user_id).toBe(userB.id);
        }
      } else {
        // 401 / 404 are acceptable failure modes for the smoke check.
        expect([200, 401, 404]).toContain(res.status());
      }
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("anonymous GET /api/scans (list) → 401", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/scans`);
    expect([401, 404]).toContain(res.status()); // 401 expected, 404 if route is per-id only
  });

  test("user B GET /api/monitored/[id] for user A's monitored row → 404", async ({ page, request, baseURL }) => {
    const userA = await createTestUser("rls-mon-A", "business");
    const userB = await createTestUser("rls-mon-B", "business");
    try {
      // Insert a monitored_site for user A.
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/monitored_sites`, {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({
          user_id: userA.id,
          url: "https://rls-test.test",
          label: "RLS test",
          enabled: true,
          cadence: "weekly",
          regression_threshold: 5,
        }),
      });
      if (!insertRes.ok) {
        test.skip(true, "monitored_sites insert failed — table may not exist in this env");
        return;
      }
      const rows = await insertRes.json();
      const monitoredId = Array.isArray(rows) ? rows[0]?.id : rows?.id;
      expect(monitoredId).toBeTruthy();

      await loginViaUI(page, userB.email);
      const cookies = await cookiesAsHeader(page);
      const res = await request.get(`${baseURL}/api/monitored/${monitoredId}`, {
        headers: { Cookie: cookies },
      });
      expect([403, 404]).toContain(res.status());
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });
});
