import { test, expect } from "@playwright/test";

test.describe("Landing page — AccessiScan", () => {
  test("shows Title II deadline banner with live countdown", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("DOJ Title II Web Accessibility Deadline"),
    ).toBeVisible();
    await expect(page.getByText(/April 24, 2026|April 26, 2027/).first()).toBeVisible();

    await expect(page.getByText("Days", { exact: true })).toBeVisible();
    await expect(page.getByText("Hrs", { exact: true })).toBeVisible();
    await expect(page.getByText("Min", { exact: true })).toBeVisible();
    await expect(page.getByText("Sec", { exact: true })).toBeVisible();
  });

  test("hero mentions FTC fine and VPAT 2.5", async ({ page }) => {
    await page.goto("/");

    // Hero copy names the FTC fine and VPAT as the core positioning
    await expect(page.getByText(/FTC fined accessiBe/i).first()).toBeVisible();
    await expect(page.getByText(/VPAT 2\.5/).first()).toBeVisible();
    // The 5,100+ figure moved to the stats strip below
    await expect(page.getByText(/5,100\+/).first()).toBeVisible();
  });

  test("government CTA section is visible with VPAT + CI/CD messaging", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/VPAT 2\.5 .* CI\/CD/).first()).toBeVisible();
    await expect(page.getByText(/GitHub Action/).first()).toBeVisible();
  });

  test("pricing shows $19 Pro and $49 Agency", async ({ page }) => {
    await page.goto("/#pricing");

    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Agency", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("$19").first()).toBeVisible();
    await expect(page.getByText("$49").first()).toBeVisible();
  });
});
