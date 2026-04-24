import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
  setUserRole,
} from "../helpers/test-utils";

let regularUser: { id: string; email: string };
let adminUser: { id: string; email: string };

test.beforeAll(async () => {
  [regularUser, adminUser] = await Promise.all([
    createTestUser("admin-regular"),
    createTestUser("admin-super"),
  ]);
  await setUserRole(adminUser.id, "admin");
});

test.afterAll(async () => {
  await Promise.all([
    regularUser?.id ? deleteTestUser(regularUser.id) : Promise.resolve(),
    adminUser?.id ? deleteTestUser(adminUser.id) : Promise.resolve(),
  ]);
});

test.describe("Admin panel access", () => {
  test("regular user is blocked from /admin (403 or redirect)", async ({ page }) => {
    await loginViaUI(page, regularUser.email);
    const resp = await page.goto("/admin");
    // Either the server returns 403/401 or redirects away from /admin.
    if (resp && [401, 403, 404].includes(resp.status())) {
      return;
    }
    // If no HTTP-level block, must redirect away:
    await expect(page).not.toHaveURL(/\/admin\/?$/);
  });

  test("admin user can load /admin and sees user list", async ({ page }) => {
    await loginViaUI(page, adminUser.email);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
    // Our admin user will appear in the table (at minimum).
    await expect(page.getByText(adminUser.email)).toBeVisible();
  });

  test("sidebar shows 'Admin Panel' link only for admin users", async ({ page }) => {
    await loginViaUI(page, adminUser.email);
    await expect(page.getByRole("link", { name: /admin/i })).toBeVisible();

    // Regular user must NOT see the admin link.
    await page.context().clearCookies();
    await loginViaUI(page, regularUser.email);
    await expect(page.getByRole("link", { name: /admin panel/i })).not.toBeVisible();
  });
});
