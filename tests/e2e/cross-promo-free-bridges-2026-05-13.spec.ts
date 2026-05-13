/**
 * E2E for the 2026-05-13 cross-promo refactor.
 *
 * Every app's footer should land visitors on the sibling app's /free
 * tool (not its homepage), so portfolio-wide footer traffic produces
 * activations instead of just clicks.
 *
 * This spec runs against AccessiScan. The mirror specs in CallSpark +
 * AIComply cover the other directions.
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "https://accessiscan.piposlab.com";

test.describe("AccessiScan footer cross-promo — points at sibling /free tools", () => {
  test("footer links to CallSpark /free/transcript-check", async ({ page }) => {
    await page.goto(BASE);
    const link = page.locator('a[href="https://callspark.piposlab.com/free/transcript-check"]').first();
    await expect(link).toBeVisible();
  });

  test("footer links to AIComply /free/risk-checker", async ({ page }) => {
    await page.goto(BASE);
    const link = page.locator('a[href="https://aicomply.piposlab.com/free/risk-checker"]').first();
    await expect(link).toBeVisible();
  });

  test("footer links to Pipo Labs portfolio", async ({ page }) => {
    await page.goto(BASE);
    const link = page.locator('a[href="https://piposlab.com"]').first();
    await expect(link).toBeVisible();
  });

  test("CallSpark cross-promo tagline mentions 'Free'", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/Free call-transcript analyzer/i).first()).toBeVisible();
  });

  test("AIComply cross-promo tagline mentions 'Free'", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/Free EU AI Act risk-checker/i).first()).toBeVisible();
  });
});
