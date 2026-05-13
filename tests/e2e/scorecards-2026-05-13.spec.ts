/**
 * E2E for /scorecards index + sitemap surfacing (shipped 2026-05-13).
 *
 * 1. /scorecards renders with stats grid + table
 * 2. /scorecards lists at least 1 scan permalink linking to /scan-result/[token]
 * 3. /sitemap.xml includes /scorecards
 * 4. /sitemap.xml includes scan-result permalinks (long-tail SEO)
 */

import { test, expect, request } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "https://accessiscan.piposlab.com";

test.describe("AccessiScan /scorecards + sitemap (shipped 2026-05-13)", () => {
  test("/scorecards renders + stats grid + at least one row links to a scan permalink", async ({ page }) => {
    await page.goto(`${BASE}/scorecards`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Every site we/i)).toBeVisible();
    // 4 stat tiles
    for (const label of ["Sites scanned", "Passing (≥90)", "Review (75-89)", "Failing (<75)"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    // Table + at least 1 row linking to /scan-result/<token>
    const link = page.locator('a[href^="/scan-result/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/scan-result\/[A-Za-z0-9_-]+$/);
  });

  test("/sitemap.xml lists /scorecards + at least one /scan-result permalink", async () => {
    const ctx = await request.newContext();
    const r = await ctx.get(`${BASE}/sitemap.xml`);
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body).toContain("/scorecards");
    expect(body).toMatch(/\/scan-result\/[A-Za-z0-9_-]+/);
  });
});
