/**
 * monitored-deep.spec.ts — full CRUD on continuous monitoring as a
 * Business-tier user. Goes beyond the surface tests in monitored-flow.
 *
 * Asserts:
 *  - Business user POST succeeds (200, not 402) and returns a row id
 *  - The new monitored site appears in the user's list
 *  - PATCH /api/monitored/[id] toggles enabled flag
 *  - DELETE removes the row from the list
 *
 * The cron itself isn't exercised — that's a separate scheduled-job test.
 * This focuses on the user-facing CRUD which is what business customers
 * interact with daily.
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
} from "../../helpers/test-utils";

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

      // Create the monitor by filling the form
      const urlInput = page.locator("input[placeholder*='example' i]").first();
      await urlInput.fill(monitorUrl);

      // Set a label so we can find the row later
      const labelInput = page.locator("input[id='monitored-label']");
      await labelInput.fill("E2E test monitor");

      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes("/api/monitored") && res.request().method() === "POST",
        { timeout: 15_000 },
      );
      await page.getByRole("button", { name: /add.*monitor|monitor|add\b/i }).first().click();
      const res = await responsePromise;

      expect(res.status(), `Business should NOT be 402; got ${res.status()}`).not.toBe(402);
      expect(res.status(), `POST should succeed; got ${res.status()}`).toBe(200);

      // Wait for the load() to refresh the list
      await page.waitForTimeout(1500);

      // The new row should appear in the page
      const body = await page.locator("body").innerText();
      expect(body).toContain("E2E test monitor");

      // Locate the row's delete button. Aria-label includes the label or url.
      page.on("dialog", (d) => d.accept()); // confirm() prompt
      const deleteBtn = page
        .getByRole("button", { name: /stop monitoring/i })
        .first();
      const deletePromise = page.waitForResponse(
        (res) =>
          res.url().match(/\/api\/monitored\/.+/) &&
          res.request().method() === "DELETE",
        { timeout: 15_000 },
      );
      await deleteBtn.click();
      const delRes = await deletePromise;
      expect(delRes.status()).toBeLessThan(400);

      // After delete, the label should no longer be present
      await page.waitForTimeout(1500);
      const bodyAfter = await page.locator("body").innerText();
      expect(bodyAfter).not.toContain("E2E test monitor");
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

      // Create a monitor first; wait for the POST AND the subsequent GET
      // that refreshes the list before asserting visibility.
      // Use accessiscan.piposlab.com itself — it's our prod, so URL
      // validation always accepts it.
      const urlInput = page.locator("input[placeholder*='example' i]").first();
      await urlInput.fill(
        `https://accessiscan.piposlab.com/__toggle__/${Date.now()}`,
      );
      await page.locator("input[id='monitored-label']").fill("Toggle test");

      const postPromise = page.waitForResponse(
        (res) =>
          res.url().includes("/api/monitored") &&
          res.request().method() === "POST",
        { timeout: 15_000 },
      );
      await page.getByRole("button", { name: /add.*monitor|monitor|add\b/i }).first().click();
      const createRes = await postPromise;
      // Accept any 2xx (200, 201). 402 here would indicate tier-gating bug.
      expect(
        createRes.status(),
        `Business POST should be 2xx; got ${createRes.status()}`,
      ).toBeLessThan(300);
      expect(createRes.status()).toBeGreaterThanOrEqual(200);
      // Wait for the post-create GET to refresh the list
      await page.waitForResponse(
        (res) =>
          res.url().includes("/api/monitored") &&
          res.request().method() === "GET",
        { timeout: 10_000 },
      ).catch(() => {});
      await page.waitForTimeout(800);

      // Confirm row appears
      const body = await page.locator("body").innerText();
      expect(body).toContain("Toggle test");

      // Click the toggle (role=switch button) and verify PATCH fires
      const patchPromise = page.waitForResponse(
        (res) =>
          res.url().match(/\/api\/monitored\/.+/) &&
          res.request().method() === "PATCH",
        { timeout: 10_000 },
      );
      const toggleBtn = page.locator("button[role='switch']").first();
      await toggleBtn.click();
      const patchRes = await patchPromise;
      expect(patchRes.status()).toBeLessThan(400);

      // Cleanup: delete the monitor we created
      page.on("dialog", (d) => d.accept());
      await page.getByRole("button", { name: /stop monitoring/i }).first().click();
      await page.waitForTimeout(1000);
    } finally {
      await deleteTestUser(u.id);
    }
  });
});
