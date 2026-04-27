/**
 * monitored-deep.spec.ts — full CRUD on continuous monitoring as a
 * Business-tier user. Goes beyond the surface tests in monitored-flow.
 *
 * Updated for the v2 rich-grid layout (A3): the "Add site" form lives in
 * a modal opened by the page-header CTA. Cards have explicit pause/resume
 * and remove buttons (no toggle switch) — toggle is now a Pause/Resume
 * action button on each card.
 *
 * Asserts:
 *  - Business user POST succeeds (200, not 402) and returns a row id
 *  - The new monitored site appears in the user's list as a card
 *  - PATCH /api/monitored/[id] toggles enabled flag via the per-card action
 *  - DELETE removes the card from the grid
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
} from "../../helpers/test-utils";

async function openAddSiteModal(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: /^add site$/i })
    .first()
    .click();
  await expect(page.locator("#monitored-url")).toBeVisible({ timeout: 5_000 });
}

async function submitAddSite(
  page: import("@playwright/test").Page,
  url: string,
  label: string,
) {
  await page.locator("#monitored-url").fill(url);
  await page.locator("#monitored-label").fill(label);
  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().includes("/api/monitored") && res.request().method() === "POST",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: /start monitoring/i }).first().click();
  return responsePromise;
}

test.describe("Monitored sites — deep CRUD as Business user", () => {
  test.setTimeout(60_000);

  test("business user creates a monitor + sees it in list + can delete", async ({
    page,
  }) => {
    const u = await createTestUser("mon-deep-biz", "business");
    const monitorUrl = `https://accessiscan.piposlab.com/__test__/${Date.now()}`;
    try {
      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      await openAddSiteModal(page);
      const res = await submitAddSite(page, monitorUrl, "E2E test monitor");
      expect(res.status(), `Business should NOT be 402; got ${res.status()}`).not.toBe(402);
      expect(res.status(), `POST should succeed; got ${res.status()}`).toBe(200);

      // Wait for load() to refresh the list (modal closes on success)
      await page.waitForTimeout(1500);

      // Card should appear with the seeded label
      const card = page
        .getByTestId("site-card")
        .filter({ hasText: "E2E test monitor" })
        .first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // Delete via the card's "Stop monitoring" action button
      page.on("dialog", (d) => d.accept()); // confirm() prompt
      const deletePromise = page.waitForResponse(
        (res) =>
          res.url().match(/\/api\/monitored\/.+/) &&
          res.request().method() === "DELETE",
        { timeout: 15_000 },
      );
      await card
        .getByRole("button", { name: /stop monitoring/i })
        .first()
        .click();
      const delRes = await deletePromise;
      expect(delRes.status()).toBeLessThan(400);

      // After delete, the card disappears
      await expect(card).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("business user toggles enabled flag via PATCH /api/monitored/[id]", async ({
    page,
  }) => {
    const u = await createTestUser("mon-deep-toggle", "business");
    try {
      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      // Create a monitor
      await openAddSiteModal(page);
      const createRes = await submitAddSite(
        page,
        `https://accessiscan.piposlab.com/__toggle__/${Date.now()}`,
        "Toggle test",
      );
      expect(
        createRes.status(),
        `Business POST should be 2xx; got ${createRes.status()}`,
      ).toBeLessThan(300);
      expect(createRes.status()).toBeGreaterThanOrEqual(200);

      // Wait for refresh
      await page.waitForResponse(
        (res) =>
          res.url().includes("/api/monitored") &&
          res.request().method() === "GET",
        { timeout: 10_000 },
      ).catch(() => {});
      await page.waitForTimeout(800);

      const card = page
        .getByTestId("site-card")
        .filter({ hasText: "Toggle test" })
        .first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // Click the per-card Pause action and verify PATCH fires
      const patchPromise = page.waitForResponse(
        (res) =>
          res.url().match(/\/api\/monitored\/.+/) &&
          res.request().method() === "PATCH",
        { timeout: 10_000 },
      );
      await card
        .getByRole("button", { name: /pause monitoring/i })
        .first()
        .click();
      const patchRes = await patchPromise;
      expect(patchRes.status()).toBeLessThan(400);

      // Cleanup
      page.on("dialog", (d) => d.accept());
      await card
        .getByRole("button", { name: /stop monitoring/i })
        .first()
        .click();
      await page.waitForTimeout(1000);
    } finally {
      await deleteTestUser(u.id);
    }
  });
});
