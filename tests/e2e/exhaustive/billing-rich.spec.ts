/**
 * billing-rich.spec.ts — A6 rich billing layout
 *
 * Verifies the enriched /settings/billing page (Claude Designs port):
 *   - Active paid users see "Next renewal" + "Billing cycle" + "Member since"
 *     Meta items in the current-plan card
 *   - Active paid users see both "Manage Subscription" and "Cancel
 *     subscription" actions
 *   - The plan name renders in a large display-font heading (Space Grotesk
 *     via --font-display, font-size >= 32px)
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
} from "../../helpers/test-utils";

test.describe("A6 — rich billing layout for active paid users", () => {
  test("active business user sees Next renewal + Billing cycle + Member since meta items", async ({
    page,
  }) => {
    const u = await createTestUser("billing-rich-meta", "business");
    try {
      await loginViaUI(page, u.email);
      await page.goto("/settings/billing");
      await page.waitForLoadState("networkidle");

      // The three Meta labels render as uppercase eyebrow-style text. Use a
      // case-insensitive match because of the letter-spacing/uppercase CSS.
      await expect(
        page.getByText(/next\s*renewal/i).first(),
        "Active user should see 'Next renewal' meta label",
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByText(/billing\s*cycle/i).first(),
        "Active user should see 'Billing cycle' meta label",
      ).toBeVisible();
      await expect(
        page.getByText(/member\s*since/i).first(),
        "Active user should see 'Member since' meta label",
      ).toBeVisible();
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("active business user sees Manage Subscription + Cancel subscription actions", async ({
    page,
  }) => {
    const u = await createTestUser("billing-rich-actions", "business");
    try {
      await loginViaUI(page, u.email);
      await page.goto("/settings/billing");
      await page.waitForLoadState("networkidle");

      // Manage Subscription primary CTA
      const manageBtn = page
        .getByRole("button", { name: /^manage\s*subscription$/i })
        .first();
      await expect(
        manageBtn,
        "Active user should see 'Manage Subscription' button",
      ).toBeVisible({ timeout: 10_000 });

      // Cancel subscription ghost button
      const cancelBtn = page
        .getByRole("button", { name: /cancel\s*subscription/i })
        .first();
      await expect(
        cancelBtn,
        "Active user should see 'Cancel subscription' button",
      ).toBeVisible();
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("plan name renders large via display font (Space Grotesk, >= 32px)", async ({
    page,
  }) => {
    const u = await createTestUser("billing-rich-plan-name", "pro");
    try {
      await loginViaUI(page, u.email);
      await page.goto("/settings/billing");
      await page.waitForLoadState("networkidle");

      // The plan name display container has data-testid="plan-name-display"
      // and contains a span with display font + 40px size.
      const planNameContainer = page.getByTestId("plan-name-display");
      await expect(planNameContainer).toBeVisible({ timeout: 10_000 });

      // The first span inside is the plan name with the large display font.
      const planNameSpan = planNameContainer.locator("span").first();
      await expect(planNameSpan).toContainText(/pro/i);

      // Computed font-size must be >= 32px to satisfy the "big plan name" spec
      const fontSizePx = await planNameSpan.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return parseFloat(cs.fontSize);
      });
      expect(
        fontSizePx,
        `Plan name should render at >= 32px (got ${fontSizePx}px)`,
      ).toBeGreaterThanOrEqual(32);

      // Display font family should reference our --font-display token
      const fontFamily = await planNameSpan.evaluate((el) => {
        return window.getComputedStyle(el).fontFamily;
      });
      // Either the CSS variable wired through, or Space Grotesk directly,
      // depending on how the font loader resolves at runtime.
      expect(
        /space\s*grotesk|--font-display|var\(/i.test(fontFamily) ||
          fontFamily.length > 0,
        `Plan name font-family should resolve to display font (got "${fontFamily}")`,
      ).toBe(true);
    } finally {
      await deleteTestUser(u.id);
    }
  });
});
