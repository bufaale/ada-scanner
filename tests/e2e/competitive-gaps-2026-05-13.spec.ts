/**
 * E2E smoke for competitive-gaps builds shipped 2026-05-13.
 *
 * Five surfaces:
 *   1. /pricing  → has the ROI calculator with Seyfarth-sourced math
 *   2. /trust    → renders portfolio scores + badge embed section
 *   3. /badge/[domain]            → returns SVG with score
 *   4. /badge/[domain]?format=js  → returns JS that injects the badge
 *   5. /scan-result/[token]       → renders a public scan permalink
 *
 * Runs against TEST_BASE_URL (defaults to live prod). No auth needed —
 * all surfaces are public.
 */

import { test, expect, request } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "https://accessiscan.piposlab.com";

test.describe("competitive-gaps shipped 2026-05-13", () => {
  test("ROI calculator on /pricing — visible + Seyfarth ref + inputs interactive", async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await expect(page.locator("h2#roi-calc-h")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("h2#roi-calc-h")).toContainText(/years/i);

    // Seyfarth attribution must be present (data integrity).
    // It's below-the-fold in the calculator footer — scroll into view.
    const seyfarth = page.getByText(/Seyfarth/i).first();
    await seyfarth.scrollIntoViewIfNeeded();
    await expect(seyfarth).toBeVisible();

    // Three numeric inputs (pages, avg cost, risk %)
    const inputs = page.locator('input[type="number"]');
    await expect(inputs).toHaveCount(3);

    // Default expected annual cost = 35000 * 15% = $5,250
    await expect(page.getByText(/\$5,250/)).toBeVisible({ timeout: 5_000 });

    // Change risk % and verify the math recomputes
    await inputs.nth(2).fill("30");
    await expect(page.getByText(/\$10,500/)).toBeVisible({ timeout: 5_000 });
  });

  test("/trust public page — renders portfolio + badge embed snippets", async ({ page }) => {
    await page.goto(`${BASE}/trust`);
    await expect(page.locator("h1")).toContainText(/Trust Center/i, { timeout: 20_000 });

    // Portfolio entries — AccessiScan should appear
    await expect(page.getByText("AccessiScan", { exact: true }).first()).toBeVisible();

    // Badge embed section + live preview img
    await expect(page.getByText(/Embed the badge/i)).toBeVisible();
    await expect(page.getByText(/Drop-in script/i)).toBeVisible();

    const badgeImg = page.locator(
      'img[src*="/badge/accessiscan.piposlab.com"]',
    );
    await expect(badgeImg).toBeVisible();
  });

  test("badge endpoint serves SVG with correct content-type + score", async () => {
    const ctx = await request.newContext();
    const r = await ctx.get(`${BASE}/badge/accessiscan.piposlab.com`);
    expect(r.ok()).toBeTruthy();
    expect(r.status()).toBe(200);
    const headers = r.headers();
    expect(headers["content-type"]).toContain("image/svg");
    const body = await r.text();
    expect(body).toContain("ACCESSISCAN");
    expect(body).toContain("WCAG");
    // Should have some numeric score (0-100) or "—" placeholder
    expect(body).toMatch(/>\s*(100|9\d|8\d|7\d|6\d|5\d|4\d|3\d|2\d|1\d|\d|—)\s*</);
  });

  test("badge?format=js serves a JS payload that injects the badge", async () => {
    const ctx = await request.newContext();
    const r = await ctx.get(`${BASE}/badge/accessiscan.piposlab.com?format=js`);
    expect(r.ok()).toBeTruthy();
    expect(r.headers()["content-type"]).toContain("javascript");
    const body = await r.text();
    expect(body).toContain("createElement");
    expect(body).toContain("badge/accessiscan.piposlab.com");
    // The script must point clicks at accessiscan.piposlab.com somewhere
    expect(body).toContain("accessiscan.piposlab.com");
  });

  test("scan-result permalink — runs a fresh scan + verifies the public page renders", async ({ page, request: req }) => {
    const apiRes = await req.post(`${BASE}/api/free/wcag-scan`, {
      data: { url: "https://example.com" },
    });
    expect(apiRes.ok()).toBeTruthy();
    const body = await apiRes.json();
    expect(body.share_token).toBeTruthy();
    expect(body.share_url).toContain("/scan-result/");

    // Visit the permalink
    await page.goto(body.share_url);
    await expect(page.locator("h1")).toContainText(/example\.com/i, { timeout: 20_000 });
    // "WCAG" appears in many spots — assert the conformance subtitle specifically
    await expect(
      page.getByText(/WCAG 2.1 AA conformance scan/i).first(),
    ).toBeVisible();
    // Upgrade CTA
    await expect(page.getByRole("link", { name: /pricing/i }).first()).toBeVisible();
  });

  test("scan-result OG image renders without error", async () => {
    const ctx = await request.newContext();
    const apiRes = await ctx.post(`${BASE}/api/free/wcag-scan`, {
      data: { url: "https://example.com" },
    });
    const { share_token } = await apiRes.json();
    expect(share_token).toBeTruthy();

    const og = await ctx.get(`${BASE}/scan-result/${share_token}/opengraph-image`);
    expect(og.ok()).toBeTruthy();
    expect(og.headers()["content-type"]).toContain("image/png");
    // PNG should be non-trivial in size (>10 KB)
    const buf = await og.body();
    expect(buf.length).toBeGreaterThan(10_000);
  });
});
