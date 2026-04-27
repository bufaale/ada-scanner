/**
 * monitored-flow.spec.ts — baseline contract tests for /dashboard/monitored.
 *
 * Updated for the v2 rich-grid layout (A3): the "Add site" form lives inside
 * a modal that opens on the "Add site" CTA click. Free users see only the
 * upsell banner; Business users see the grid + KPI strip + Add-site CTA.
 *
 * Contract:
 *  - Page renders heading for any tier (the page itself is not gated)
 *  - Free users see the upsell banner, NOT the Add-site form
 *  - Business users can open the Add-site modal and submit a URL → POST fires
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
} from "../../helpers/test-utils";

test.describe("Monitored sites — page contract", () => {
  test("page renders heading for any tier (free)", async ({ page }) => {
    const u = await createTestUser("monitored-render", "free");
    try {
      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByRole("heading", { name: /monitored sites/i, level: 1 }),
      ).toBeVisible({ timeout: 10_000 });

      // Free user sees the upsell banner, not the grid
      await expect(page.getByTestId("monitored-upsell")).toBeVisible();
      await expect(page.getByTestId("monitored-grid")).toHaveCount(0);
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("business user can open Add-site modal and submit triggers POST /api/monitored", async ({
    page,
  }) => {
    const u = await createTestUser("monitored-submit", "business");
    try {
      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      // Open the Add-site modal via the page-header CTA
      await page
        .getByRole("button", { name: /^add site$/i })
        .first()
        .click();

      const urlInput = page.locator("#monitored-url");
      await expect(urlInput).toBeVisible({ timeout: 5_000 });
      await urlInput.fill("https://monitored-flow-test.example.com");

      const postPromise = page.waitForRequest(
        (req) => req.url().includes("/api/monitored") && req.method() === "POST",
        { timeout: 10_000 },
      );
      await page
        .getByRole("button", { name: /start monitoring/i })
        .first()
        .click();
      const req = await postPromise;
      expect(req.method()).toBe("POST");
    } finally {
      await deleteTestUser(u.id);
    }
  });
});
