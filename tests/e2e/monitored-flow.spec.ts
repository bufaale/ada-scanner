import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
} from "../helpers/test-utils";

let user: { id: string; email: string };

test.beforeAll(async () => {
  user = await createTestUser("monitored", "business");
});

test.afterAll(async () => {
  if (user?.id) await deleteTestUser(user.id);
});

test.describe.serial("Monitored sites — business-tier full flow", () => {
  test("business user can add a monitored site", async ({ page }) => {
    await loginViaUI(page, user.email);
    await page.goto("/dashboard/monitored");

    await page.getByLabel(/^URL$/i).fill("https://example.com");
    await page.getByLabel(/label/i).first().fill("E2E test site");
    // cadence select
    await page.getByLabel(/cadence/i).selectOption({ label: /weekly/i });
    await page.getByLabel(/alert email/i).fill(user.email);
    await page.getByRole("button", { name: /Add to monitoring/i }).click();

    // Site appears in the list after creation. Try toast first, then list item.
    await expect(page.getByText(/added|site added/i).or(
      page.getByText("example.com"),
    ).first()).toBeVisible({ timeout: 10_000 });
  });

  test("monitored site appears in the list", async ({ page }) => {
    await loginViaUI(page, user.email);
    await page.goto("/dashboard/monitored");
    await expect(page.getByText("example.com").first()).toBeVisible();
  });

  test("monitored list shows the cadence + label", async ({ page }) => {
    await loginViaUI(page, user.email);
    await page.goto("/dashboard/monitored");
    await expect(page.getByText(/weekly/i).first()).toBeVisible();
    await expect(page.getByText(/E2E test site/i).first()).toBeVisible();
  });
});
