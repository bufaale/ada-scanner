import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
  type Tier,
} from "../helpers/test-utils";

// Create one user per tier up-front; reuse across tests.
type TierUser = { id: string; email: string; tier: Tier };

let users: Record<Tier, TierUser>;

test.beforeAll(async () => {
  const [free, pro, agency, business] = await Promise.all([
    createTestUser("tier-free", "free"),
    createTestUser("tier-pro", "pro"),
    createTestUser("tier-agency", "agency"),
    createTestUser("tier-business", "business"),
  ]);
  users = {
    free: { ...free, tier: "free" },
    pro: { ...pro, tier: "pro" },
    agency: { ...agency, tier: "agency" },
    business: { ...business, tier: "business" },
  };
});

test.afterAll(async () => {
  await Promise.all(
    Object.values(users || {}).map((u) => (u.id ? deleteTestUser(u.id) : Promise.resolve())),
  );
});

test.describe("Tier gating — new scan page", () => {
  test("free user sees Deep Scan disabled + upgrade prompt", async ({ page }) => {
    await loginViaUI(page, users.free.email);
    await page.goto("/dashboard/scans/new");
    const deepBtn = page.getByRole("button", { name: /Deep Scan/i });
    await expect(deepBtn).toBeDisabled();
    await expect(page.getByText(/upgrade/i).first()).toBeVisible();
  });

  for (const tier of ["pro", "agency", "business"] as const) {
    test(`${tier} user sees Deep Scan enabled`, async ({ page }) => {
      await loginViaUI(page, users[tier].email);
      await page.goto("/dashboard/scans/new");
      const deepBtn = page.getByRole("button", { name: /Deep Scan/i });
      await expect(deepBtn).toBeEnabled();
    });
  }
});

test.describe("Tier gating — monitored sites (Business-only)", () => {
  // The /dashboard/monitored UI gates the "Add site" button at the
  // disabled-button level for non-business tiers (button is disabled +
  // opacity 0.6). The backend also returns 402 if a non-business user
  // tries to POST directly. We assert both: the upsell banner is on
  // the page, and a direct POST to /api/monitored returns 402.
  for (const tier of ["free", "pro", "agency"] as const) {
    test(`${tier} user is gated when trying to add a monitored site`, async ({ page }) => {
      await loginViaUI(page, users[tier].email);
      await page.goto("/dashboard/monitored");

      // The BusinessUpsellBanner has data-testid="monitored-upsell" and
      // renders only for non-business tiers.
      await expect(page.getByTestId("monitored-upsell")).toBeVisible({ timeout: 10_000 });

      // Direct POST returns 402 (server-side enforcement, not just UI).
      const resp = await page.request.post("/api/monitored", {
        data: {
          url: "https://example.com",
          label: "Test site",
          cadence: "weekly",
          alert_email: users[tier].email,
          regression_threshold: 5,
        },
      });
      expect(resp.status()).toBe(402);
    });
  }

  test("business user: POST to /api/monitored returns 200 (not 402)", async ({ page }) => {
    await loginViaUI(page, users.business.email);
    const resp = await page.request.post("/api/monitored", {
      data: {
        url: "https://example.com",
        label: "e2e-biz-test",
        cadence: "weekly",
        alert_email: users.business.email,
        regression_threshold: 5,
      },
    });
    expect([200, 201]).toContain(resp.status());
  });
});

test.describe("Tier gating — PDF accessibility scanning (Agency/Business)", () => {
  for (const tier of ["free", "pro"] as const) {
    test(`${tier} user: POST to /api/pdf-scans returns 402`, async ({ page }) => {
      await loginViaUI(page, users[tier].email);
      const resp = await page.request.post("/api/pdf-scans", {
        multipart: {
          file: {
            name: "test.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("%PDF-1.4\n%fake\n"),
          },
        },
      });
      expect(resp.status()).toBe(402);
    });
  }

  for (const tier of ["agency", "business"] as const) {
    test(`${tier} user: pdf-scans page has no gated banner`, async ({ page }) => {
      await loginViaUI(page, users[tier].email);
      await page.goto("/dashboard/pdf-scans");
      // Heading always renders; the tier signal is absence of upgrade link.
      await expect(
        page.getByRole("heading", { name: /PDF accessibility scanning/i }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /See plans/i })).not.toBeVisible();
    });
  }
});

test.describe("Tier gating — billing page shows correct plan", () => {
  for (const tier of ["free", "pro", "agency", "business"] as const) {
    test(`${tier} user's billing page shows "${tier}" plan`, async ({ page }) => {
      await loginViaUI(page, users[tier].email);
      await page.goto("/settings/billing");
      // Plan name appears verbatim (case-insensitive)
      const planRegex = new RegExp(`\\b${tier}\\b`, "i");
      await expect(page.getByText(planRegex).first()).toBeVisible();
    });
  }
});

// Auto-Fix PRs is the killer Business-tier feature. Lock down the API so
// neither the UI gate nor the server gate can drift without us catching it.
const FAKE_UUID = "00000000-0000-0000-0000-000000000000";
const AUTOFIX_BODY = {
  scan_id: FAKE_UUID,
  issue_ids: [FAKE_UUID],
  repo_full_name: "owner/repo",
};

test.describe("Tier gating — Auto-Fix PRs (Business-only)", () => {
  for (const tier of ["free", "pro", "agency"] as const) {
    test(`${tier} user: POST /api/github-action/auto-fix returns 402`, async ({ page }) => {
      await loginViaUI(page, users[tier].email);
      const res = await page.request.post("/api/github-action/auto-fix", {
        data: AUTOFIX_BODY,
      });
      expect(res.status()).toBe(402);
      const body = await res.json();
      expect(body.error).toMatch(/business/i);
    });
  }

  test("business user without GitHub install: returns 412 with install_url", async ({ page }) => {
    await loginViaUI(page, users.business.email);
    const res = await page.request.post("/api/github-action/auto-fix", {
      data: AUTOFIX_BODY,
    });
    // Test users never have a GitHub install — should always fail at the
    // install check, not the tier gate.
    expect(res.status()).toBe(412);
    const body = await res.json();
    expect(body.error).toMatch(/github installation/i);
    expect(body.install_url).toContain("github.com/apps/");
  });

  test("unauthenticated: POST /api/github-action/auto-fix returns 401", async ({ page }) => {
    // Fresh context, no login.
    await page.context().clearCookies();
    const res = await page.request.post("/api/github-action/auto-fix", {
      data: AUTOFIX_BODY,
    });
    expect(res.status()).toBe(401);
  });

  test("business user with bad input: returns 400", async ({ page }) => {
    await loginViaUI(page, users.business.email);
    const res = await page.request.post("/api/github-action/auto-fix", {
      data: { scan_id: "not-a-uuid", issue_ids: [], repo_full_name: "missing-slash" },
    });
    expect(res.status()).toBe(400);
  });
});
