/**
 * auth-pages.spec.ts — visual regression for /login, /signup, /forgot-password.
 * AuthShell is the shared component, so a regression in any of these is
 * usually a regression in all three.
 *
 * SKIPPED in CI as of 2026-05-02: the committed baselines are
 * chromium-win32.png (generated on the dev's Windows machine) but CI runs
 * on Linux and looks for chromium-linux.png, which doesn't exist. Until
 * Linux baselines are regenerated, the suite errors before doing any real
 * visual diff. Reactivate by:
 *   1. Run on Linux (Docker or GH Actions worker) with --update-snapshots
 *   2. Commit the chromium-linux.png files
 *   3. Remove the test.describe.skip wrapper here
 */
import { test, expect } from "@playwright/test";

test.describe.skip("Auth pages — visual regression", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const route of ["/login", "/signup", "/forgot-password"] as const) {
    test(`${route} — full page snapshot`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const snapName = `auth${route.replace(/\//g, "-")}.png`;
      await expect(page).toHaveScreenshot(snapName, {
        fullPage: true,
        animations: "disabled",
        // Forgot-password page renders a live countdown to the DOJ deadline.
        mask: [page.getByText(/Days/i).first()],
      });
    });
  }
});
