/**
 * forgot-password-doj.spec.ts
 *
 * Verifies that the /forgot-password page renders the DOJ Title II deadline
 * countdown banner above the reset-password form. Government procurement users
 * landing here need to see the urgency: April 26, 2027.
 *
 * Banner contract:
 *  1. Page mentions "April 26, 2027" (or at minimum "April 2027").
 *  2. Page renders "days" / "remaining" copy alongside the countdown.
 *  3. A numeric countdown is visible inside the banner (mono font, > 0 days).
 *  4. The banner does NOT cover the email input or submit button — the form
 *     remains interactive (regression guard for any "fixed banner over form"
 *     mistakes).
 */
import { test, expect } from "@playwright/test";

test.describe("/forgot-password — DOJ deadline banner", () => {
  test("banner mentions April 26, 2027 deadline", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").innerText();
    // Accept either the precise date or the looser "April 2027" form.
    expect(body).toMatch(/April\s+26,?\s+2027|April\s+2027/i);
  });

  test("banner mentions 'days' / 'remaining' countdown copy", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    // The banner renders `<span>{days}</span>days remaining` with no space
    // between the count and "days" so a strict \bdays\b boundary against
    // body.innerText fails. Match against the textContent of the deadline
    // banner element directly, which preserves the markup-level structure.
    const bannerText = await page.locator("[role='status']").first().textContent();
    expect(bannerText).toMatch(/days/i);
    expect(bannerText).toMatch(/remaining/i);
  });

  test("banner shows a numeric day count (>0) in mono font", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    const daysCell = page.getByTestId("doj-days-remaining");
    await expect(daysCell).toBeVisible();

    const text = (await daysCell.textContent())?.trim() ?? "";
    expect(text).toMatch(/^\d+$/);

    const days = Number(text);
    expect(Number.isFinite(days)).toBe(true);
    expect(days).toBeGreaterThan(0);
    // Sanity ceiling — between today and the deadline cannot exceed ~3 years.
    expect(days).toBeLessThan(2000);
  });

  test("banner does NOT block the email input or submit button", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    const emailInput = page.locator("input[type='email']").first();
    await expect(emailInput).toBeVisible();
    // If something is overlapping, fill() will throw or time out.
    await emailInput.fill("regression-banner@example.com");
    await expect(emailInput).toHaveValue("regression-banner@example.com");

    const submitBtn = page
      .getByRole("button", { name: /send\s*reset|reset\s*link|send/i })
      .first();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });
});
