/**
 * dashboard-charts.spec.ts — verify the Claude Designs dashboard widgets
 * (ComplianceTrendCard + WcagBreakdownCard) render once the user has at
 * least one completed scan with pour_scores.
 */
import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginViaUI, seedScan } from "../../helpers/test-utils";

test.describe("Dashboard — Claude Designs widgets", () => {
  test.setTimeout(60_000);

  test("ComplianceTrendCard renders empty-state for fresh user", async ({ page }) => {
    const u = await createTestUser("trend-empty", "pro");
    try {
      await loginViaUI(page, u.email);
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const card = page.locator("[data-testid='compliance-trend-card']");
      await expect(card).toBeVisible({ timeout: 10_000 });
      // Empty-state message
      await expect(card).toContainText(/Run a scan to start tracking|Need 2\+ completed scans/i);
      // Range buttons render
      await expect(page.locator("[data-testid='trend-range-7']")).toBeVisible();
      await expect(page.locator("[data-testid='trend-range-30']")).toBeVisible();
      await expect(page.locator("[data-testid='trend-range-90']")).toBeVisible();
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("WcagBreakdownCard renders donut + 4 principles when latest scan has pour_scores", async ({
    page,
  }) => {
    const u = await createTestUser("wcag-breakdown", "pro");
    try {
      await seedScan(u.id, {
        url: "https://wcag-breakdown.example.test",
        compliance_score: 84,
        pour_scores: {
          perceivable: 91,
          operable: 88,
          understandable: 84,
          robust: 72,
        },
      });

      await loginViaUI(page, u.email);
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const card = page.locator("[data-testid='wcag-breakdown-card']");
      await expect(card).toBeVisible({ timeout: 10_000 });

      const text = await card.innerText();
      // 4 principle names rendered
      for (const name of ["Perceivable", "Operable", "Understandable", "Robust"]) {
        expect(text).toContain(name);
      }
      // POUR scores rendered numerically
      expect(text).toContain("91");
      expect(text).toContain("88");
      expect(text).toContain("84");
      expect(text).toContain("72");
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("WcagBreakdownCard hidden for user with no pour_scores in any scan", async ({
    page,
  }) => {
    const u = await createTestUser("wcag-no-pour", "free");
    try {
      // Seeded scan without pour_scores override
      await seedScan(u.id, { url: "https://no-pour.example.test", compliance_score: 70 });

      await loginViaUI(page, u.email);
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("[data-testid='wcag-breakdown-card']")).toHaveCount(0);
    } finally {
      await deleteTestUser(u.id);
    }
  });
});
