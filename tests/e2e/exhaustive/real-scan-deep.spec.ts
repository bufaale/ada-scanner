/**
 * real-scan-deep.spec.ts — exercise the actual scan pipeline.
 *
 * Most expensive test in the suite: triggers a real WCAG scan via the API,
 * the worker actually crawls + axe-cores + writes scan_issues to the DB.
 * Target: accessiscan.piposlab.com (our own prod) so the test is
 * cost-bounded and we know the URL responds.
 *
 * Assertions:
 *  1. POST /api/scans returns { scanId } for a Business user
 *  2. Within 120s, GET /api/scans/[id] shows status = 'completed'
 *  3. The scan record has a numeric compliance_score
 *
 * The waitForScanCompleted helper polls with a long timeout; if the worker
 * is down or the URL fails to crawl, the test will time out clearly.
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
} from "../../helpers/test-utils";

test.describe("Real scan pipeline — end-to-end against accessiscan.piposlab.com", () => {
  // Worker can take 30-90s for a quick scan; allow 3 min total for slow CI.
  test.setTimeout(180_000);

  test("business user triggers a quick scan + scan reaches 'completed' status", async ({
    page,
  }) => {
    const u = await createTestUser("realscan-biz", "business");
    let scanId: string | null = null;
    try {
      await loginViaUI(page, u.email);

      // Trigger scan via the new-scan UI
      await page.goto("/dashboard/scans/new");
      await page.waitForLoadState("networkidle");

      const urlInput = page.locator("input[placeholder*='example' i]").first();
      await urlInput.fill("https://accessiscan.piposlab.com");

      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().endsWith("/api/scans") && res.request().method() === "POST",
        { timeout: 15_000 },
      );
      await page
        .getByRole("button", { name: /run\s*scan|^scan$|start/i })
        .first()
        .click();
      const res = await responsePromise;
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.scanId).toBeTruthy();
      scanId = data.scanId as string;

      // Poll the scan record until status='completed' or 'failed'
      const supabaseUrl = process.env.SUPABASE_URL || "";
      const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = process.env.SUPABASE_ANON_KEY || "";

      const start = Date.now();
      const maxMs = 150_000;
      let status = "pending";
      let score: number | null = null;
      while (Date.now() - start < maxMs) {
        const r = await fetch(
          `${supabaseUrl}/rest/v1/scans?id=eq.${scanId}&select=status,compliance_score`,
          {
            headers: {
              Authorization: `Bearer ${adminKey}`,
              apikey: anonKey,
            },
          },
        );
        if (r.ok) {
          const rows = await r.json();
          if (rows[0]) {
            status = rows[0].status;
            score = rows[0].compliance_score;
            if (status === "completed" || status === "failed") break;
          }
        }
        await new Promise((res) => setTimeout(res, 3000));
      }

      expect(
        status,
        `Scan should reach 'completed' within ${maxMs / 1000}s; got '${status}' after ${Math.round((Date.now() - start) / 1000)}s`,
      ).toBe("completed");

      // Once completed, the compliance_score must be a real number
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    } finally {
      // Clean up: delete the scan row so we don't accumulate test data,
      // then delete the user.
      if (scanId) {
        const supabaseUrl = process.env.SUPABASE_URL || "";
        const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
        await fetch(`${supabaseUrl}/rest/v1/scans?id=eq.${scanId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminKey}`, apikey: adminKey },
        }).catch(() => {});
      }
      await deleteTestUser(u.id);
    }
  });
});
