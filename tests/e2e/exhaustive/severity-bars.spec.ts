/**
 * severity-bars.spec.ts — Claude Designs scan-result SeverityBars widget:
 * stacked bar + 4 severity tiles + auto-fixable count.
 */
import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginViaUI, seedScan, seedScanIssue } from "../../helpers/test-utils";

test.describe("Scan result — SeverityBars widget", () => {
  test.setTimeout(60_000);

  test("renders 4 tiles with severity counts when scan has issues", async ({ page }) => {
    const u = await createTestUser("severity-bars", "pro");
    try {
      const scan = await seedScan(u.id, {
        url: "https://severity-bars.example.test",
        compliance_score: 65,
        critical_count: 2,
        serious_count: 5,
        moderate_count: 3,
        minor_count: 1,
      });
      await seedScanIssue(scan.id, {
        rule_id: "image-alt",
        severity: "serious",
        wcag_level: "A",
        html_snippet: '<img src="x">',
        selector: 'img',
        page_url: "https://severity-bars.example.test/",
      });

      await loginViaUI(page, u.email);
      await page.goto(`/dashboard/scans/${scan.id}`);
      await page.waitForLoadState("networkidle");

      const bars = page.locator("[data-testid='severity-bars']");
      await expect(bars).toBeVisible({ timeout: 10_000 });

      const text = await bars.innerText();
      // Four severity labels (uppercased in the tiles)
      expect(text).toMatch(/critical/i);
      expect(text).toMatch(/serious/i);
      expect(text).toMatch(/moderate/i);
      expect(text).toMatch(/minor/i);
      // Counts rendered (we seeded 2/5/3/1)
      expect(text).toContain("2");
      expect(text).toContain("5");
      expect(text).toContain("3");
      // Auto-fixable / manual breakdown
      expect(text).toMatch(/auto.?fixable/i);
      expect(text).toMatch(/manual/i);
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("hidden when scan has zero issues", async ({ page }) => {
    const u = await createTestUser("severity-bars-empty", "pro");
    try {
      const scan = await seedScan(u.id, {
        url: "https://severity-bars-empty.example.test",
        compliance_score: 100,
        critical_count: 0,
        serious_count: 0,
        moderate_count: 0,
        minor_count: 0,
      });

      await loginViaUI(page, u.email);
      await page.goto(`/dashboard/scans/${scan.id}`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("[data-testid='severity-bars']")).toHaveCount(0);
    } finally {
      await deleteTestUser(u.id);
    }
  });
});
