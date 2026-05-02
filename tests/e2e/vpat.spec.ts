import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
  setUserPlan,
} from "../helpers/test-utils";

let freeUser: { id: string; email: string };
let proUser: { id: string; email: string };

test.beforeAll(async () => {
  [freeUser, proUser] = await Promise.all([
    createTestUser("vpat-free"),
    createTestUser("vpat-pro"),
  ]);
  await setUserPlan(proUser.id, "pro");
});

test.afterAll(async () => {
  await Promise.all([
    freeUser?.id ? deleteTestUser(freeUser.id) : Promise.resolve(),
    proUser?.id ? deleteTestUser(proUser.id) : Promise.resolve(),
  ]);
});

async function runQuickScanAndGetId(page: import("@playwright/test").Page) {
  await page.getByRole("link", { name: "New Scan" }).click();
  await page.locator("#scan-url").fill("https://example.com");
  await page.getByRole("button", { name: "Run Scan" }).click();
  await page.waitForURL(/\/dashboard\/scans\/[0-9a-f-]+/, { timeout: 90_000 });
  await expect(page.getByText("Completed")).toBeVisible({ timeout: 30_000 });
  const match = page.url().match(/\/dashboard\/scans\/([0-9a-f-]+)/);
  if (!match) throw new Error("Could not extract scan id");
  return match[1];
}

test.describe.serial("VPAT 2.5 export", () => {
  test("free users see VPAT gated with Pro badge and are redirected to billing", async ({ page }) => {
    test.setTimeout(150_000);

    await loginViaUI(page, freeUser.email);
    await runQuickScanAndGetId(page);

    // Free tier shows a single combined button "VPAT / EN 301 549" with a Pro badge.
    const vpatButton = page.getByRole("button", { name: /VPAT.*EN 301 549/i });
    await expect(vpatButton).toBeVisible();
    await expect(vpatButton.getByText(/^Pro$/)).toBeVisible();

    await vpatButton.click();
    await page.waitForURL("**/settings/billing", { timeout: 10_000 });
  });

  test("pro users download a valid VPAT PDF", async ({ page }) => {
    test.setTimeout(150_000);

    await loginViaUI(page, proUser.email);
    const scanId = await runQuickScanAndGetId(page);

    // The Pro/Agency VPAT button is an <a> wrapped in <Button asChild>.
    const vpatLink = page.getByRole("link", { name: /VPAT 2\.5/i });
    await expect(vpatLink).toBeVisible();
    await expect(vpatLink).toHaveAttribute("href", `/api/scans/${scanId}/vpat`);

    // Trigger the download and assert the response is a PDF.
    const response = await page.request.get(`/api/scans/${scanId}/vpat`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect(response.headers()["content-disposition"]).toContain("vpat-2.5-");

    const buffer = await response.body();
    // PDFs always start with the %PDF- magic bytes.
    expect(buffer.slice(0, 5).toString()).toBe("%PDF-");
    // A multi-page VPAT should be more than a kilobyte.
    expect(buffer.byteLength).toBeGreaterThan(5_000);
  });
});
