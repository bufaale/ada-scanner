import { test, expect, type Page } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
  auditPageLinks,
} from "../helpers/test-utils";

let user: { id: string; email: string };

test.beforeAll(async () => {
  user = await createTestUser("linkaudit");
});

test.afterAll(async () => {
  if (user?.id) await deleteTestUser(user.id);
});

/**
 * Every internal link on a rendered page MUST return 2xx/3xx — never 404.
 * This is the test that would have caught the /pricing → 404 regression
 * we shipped. Runs the audit on every page a signed-in user can reach.
 */
async function auditAndAssert(page: Page, path: string) {
  const results = await auditPageLinks(page, {
    ignore: [
      /^\/logout/,
      /^\/api\//, // API routes are audited elsewhere
      /^\/auth\/confirm/, // OTP callback, requires token
    ],
  });
  const broken = results.filter((r) => r.status === 404);
  if (broken.length) {
    console.log(`Broken links on ${path}:`, broken);
  }
  expect(broken, `Broken links on ${path}: ${JSON.stringify(broken)}`).toEqual([]);
}

test.describe("Link audit — no 404s on any rendered page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, user.email);
  });

  test("dashboard home has no broken internal links", async ({ page }) => {
    await auditAndAssert(page, "/dashboard");
  });

  test("new scan page has no broken internal links", async ({ page }) => {
    await page.goto("/dashboard/scans/new");
    await auditAndAssert(page, "/dashboard/scans/new");
  });

  test("scan history has no broken internal links", async ({ page }) => {
    await page.goto("/dashboard/scans");
    await auditAndAssert(page, "/dashboard/scans");
  });

  test("monitored sites page has no broken internal links", async ({ page }) => {
    await page.goto("/dashboard/monitored");
    await auditAndAssert(page, "/dashboard/monitored");
  });

  test("pdf-scans page has no broken internal links", async ({ page }) => {
    await page.goto("/dashboard/pdf-scans");
    await auditAndAssert(page, "/dashboard/pdf-scans");
  });

  test("settings profile has no broken internal links", async ({ page }) => {
    await page.goto("/settings");
    await auditAndAssert(page, "/settings");
  });

  test("settings billing has no broken internal links", async ({ page }) => {
    await page.goto("/settings/billing");
    await auditAndAssert(page, "/settings/billing");
  });
});

test.describe("Link audit — public marketing pages", () => {
  for (const path of [
    "/",
    "/terms",
    "/privacy",
    "/refund",
    "/why-not-overlays",
    "/overlay-detector",
    "/blog",
  ]) {
    test(`${path} has no broken internal links`, async ({ page }) => {
      await page.goto(path);
      await auditAndAssert(page, path);
    });
  }
});
