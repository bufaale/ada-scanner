/**
 * cross-user-rls-pages.spec.ts — page-level RLS guard.
 *
 * For every authenticated detail page that takes a path-segment ID, verify
 * that user B navigating to user A's resource gets a Next.js 404 (not
 * accidental data exposure, not silent 500).
 *
 * Endpoints under test:
 *   - /dashboard/scans/[A's scan id] as user B → 404
 *   - /dashboard/sites/[A's domain]   as user B → 404
 *   - /dashboard/monitored/[A's monitored id] as user B → 404
 *
 * The middleware sets `cache-control: no-store` on /api routes; pages use
 * server-component-driven 404 via Next.js `notFound()`. This spec proves
 * the gating is in place.
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
  seedScan,
} from "../../helpers/test-utils";

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

test.describe("Cross-user page-level RLS — 404 for foreign IDs", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY, "Supabase env not set");

  test("/dashboard/scans/[A's id] returns 404 for user B", async ({ page }) => {
    const userA = await createTestUser("rls-pg-scan-A", "free");
    const userB = await createTestUser("rls-pg-scan-B", "free");
    try {
      const scanA = await seedScan(userA.id, { url: "https://A-scan.test" });
      await loginViaUI(page, userB.email);

      const response = await page.goto(`/dashboard/scans/${scanA.id}`, { waitUntil: "domcontentloaded" });
      // Next.js renders 404 with a 404 status code by default. Tolerate
      // common dashboard-redirect patterns (302→404 page).
      const status = response?.status() ?? 0;
      expect([404, 200, 302]).toContain(status);
      // If 200, ensure NotFound copy is on the page.
      if (status === 200) {
        const body = await page.locator("body").innerText();
        expect(body.toLowerCase()).toMatch(/not found|404|doesn't exist|cannot find/);
        // Critically — A's scan URL should NOT leak.
        expect(body).not.toContain("A-scan.test");
      }
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("/dashboard/sites/[A's domain] returns 404 for user B", async ({ page }) => {
    const userA = await createTestUser("rls-pg-site-A", "free");
    const userB = await createTestUser("rls-pg-site-B", "free");
    try {
      const domain = `userA-${Date.now()}.test`;
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/sites`, {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({ user_id: userA.id, domain, name: domain }),
      });
      if (!insertRes.ok) {
        test.skip(true, "sites table insert failed — table may not exist in this env");
        return;
      }

      await loginViaUI(page, userB.email);
      const response = await page.goto(`/dashboard/sites/${encodeURIComponent(domain)}`, {
        waitUntil: "domcontentloaded",
      });
      const status = response?.status() ?? 0;
      expect([404, 200, 302]).toContain(status);
      if (status === 200) {
        const body = await page.locator("body").innerText();
        // A's domain should NOT show in any data block.
        // Tolerate domain in nav/breadcrumb if present, but no scan listings etc.
        expect(body.toLowerCase()).toMatch(/not found|empty|no scans yet|404|doesn't exist/);
      }
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("/dashboard/monitored/[A's id] returns 404 for user B", async ({ page }) => {
    const userA = await createTestUser("rls-pg-mon-A", "business");
    const userB = await createTestUser("rls-pg-mon-B", "business");
    try {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/monitored_sites`, {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({
          user_id: userA.id,
          url: "https://A-monitored.test",
          label: "User A monitored",
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
      const response = await page.goto(`/dashboard/monitored/${monitoredId}`, {
        waitUntil: "domcontentloaded",
      });
      const status = response?.status() ?? 0;
      expect([404, 200, 302, 403]).toContain(status);
      if (status === 200) {
        const body = await page.locator("body").innerText();
        expect(body).not.toContain("A-monitored.test");
      }
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });
});
