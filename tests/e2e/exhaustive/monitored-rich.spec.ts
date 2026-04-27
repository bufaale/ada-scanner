/**
 * monitored-rich.spec.ts — A3 rich monitored-sites grid.
 *
 * Verifies the upgraded /dashboard/monitored page:
 *  - Business user with seeded sites sees a card grid (not a table) with
 *    domain, score, sparkline svg per card.
 *  - KPI strip computes total / avg score / at-risk from the seeded data.
 *  - Score color matches threshold (green ≥85, amber 70-84, red <70).
 *  - "Recently changed" feed renders (mock data — boundary marked in code).
 *  - Free user sees the upsell banner, NOT the grid.
 *
 * Sparkline + recently-changed feed are intentionally MOCKED in this PR
 * (see TODO(B4) markers in src/app/(dashboard)/dashboard/monitored/page.tsx).
 * Tests therefore only assert presence + structure, not numeric values that
 * would couple them to the mock generator.
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
} from "../../helpers/test-utils";

// ===== Test-only seeding helper for monitored_sites =====
function supabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}
function supabaseServiceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}
function supabaseAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

interface SeededSite {
  id: string;
  url: string;
}

/**
 * Seed a monitored_sites row directly via the service role. Bypasses the
 * Business-tier check + URL validator that /api/monitored uses, so we can
 * paint scenarios (regressing, paused, healthy) deterministically.
 */
async function seedMonitoredSite(
  userId: string,
  overrides: Partial<{
    url: string;
    label: string;
    cadence: "daily" | "weekly" | "monthly";
    enabled: boolean;
    last_score: number | null;
    last_critical: number;
    last_serious: number;
    last_scan_at: string | null;
  }> = {},
): Promise<SeededSite> {
  const url = overrides.url ?? `https://seeded-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.example.test`;
  const payload = {
    user_id: userId,
    url,
    label: overrides.label ?? new URL(url).hostname,
    cadence: overrides.cadence ?? "weekly",
    enabled: overrides.enabled ?? true,
    last_score: overrides.last_score ?? null,
    last_critical: overrides.last_critical ?? 0,
    last_serious: overrides.last_serious ?? 0,
    last_scan_at: overrides.last_scan_at ?? new Date().toISOString(),
    regression_threshold: 5,
  };
  const res = await fetch(`${supabaseUrl()}/rest/v1/monitored_sites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseServiceKey()}`,
      apikey: supabaseAnonKey(),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`seedMonitoredSite failed: ${await res.text()}`);
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { id: row.id, url: row.url };
}

test.describe("Monitored sites — A3 rich grid", () => {
  test.setTimeout(90_000);

  test("business user with 3 seeded sites sees grid with domain, score, sparkline per card", async ({
    page,
  }) => {
    const u = await createTestUser("mon-rich-grid", "business");
    try {
      await seedMonitoredSite(u.id, {
        url: "https://alpha-rich.example.test",
        label: "Alpha portal",
        last_score: 92,
        last_critical: 0,
        last_serious: 1,
      });
      await seedMonitoredSite(u.id, {
        url: "https://beta-rich.example.test",
        label: "Beta dashboard",
        last_score: 78,
        last_critical: 2,
        last_serious: 5,
      });
      await seedMonitoredSite(u.id, {
        url: "https://gamma-rich.example.test",
        label: "Gamma checkout",
        last_score: 65,
        last_critical: 6,
        last_serious: 9,
      });

      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      // The grid container should be present
      await expect(page.getByTestId("monitored-grid")).toBeVisible();

      // Exactly 3 site cards
      const cards = page.getByTestId("site-card");
      await expect(cards).toHaveCount(3, { timeout: 15_000 });

      // Each card: visible domain text + score node + sparkline svg
      const labels = ["Alpha portal", "Beta dashboard", "Gamma checkout"];
      for (const label of labels) {
        const card = page
          .getByTestId("site-card")
          .filter({ hasText: label })
          .first();
        await expect(card).toBeVisible();
        await expect(card.getByTestId("site-domain")).toContainText(label);
        await expect(card.getByTestId("site-score")).toBeVisible();
        await expect(card.getByTestId("site-sparkline")).toBeVisible();
      }
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("KPI strip renders total / avg score / at-risk with computed numbers", async ({
    page,
  }) => {
    const u = await createTestUser("mon-rich-kpi", "business");
    try {
      // Scores: 90, 80, 60 → avg 77; at-risk: 1 (60 is below 70)
      await seedMonitoredSite(u.id, {
        url: "https://kpi-1.example.test",
        last_score: 90,
        last_critical: 0,
      });
      await seedMonitoredSite(u.id, {
        url: "https://kpi-2.example.test",
        last_score: 80,
        last_critical: 0,
      });
      await seedMonitoredSite(u.id, {
        url: "https://kpi-3.example.test",
        last_score: 60,
        last_critical: 4, // also pushes at-risk
      });

      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      await expect(page.getByTestId("kpi-strip")).toBeVisible();

      // Total monitored = 3
      await expect(page.getByTestId("kpi-total-value")).toHaveText("3");

      // Average score = round((90+80+60)/3) = 77
      await expect(page.getByTestId("kpi-avg-score-value")).toHaveText("77");

      // At-risk: kpi-3 has critical>0 AND score<70 → 1
      await expect(page.getByTestId("kpi-at-risk-value")).toHaveText("1");
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("score color matches threshold (green ≥85, red <70)", async ({ page }) => {
    const u = await createTestUser("mon-rich-color", "business");
    try {
      await seedMonitoredSite(u.id, {
        url: "https://green-92.example.test",
        label: "Green Site",
        last_score: 92,
      });
      await seedMonitoredSite(u.id, {
        url: "https://red-65.example.test",
        label: "Red Site",
        last_score: 65,
      });

      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      const greenCard = page.getByTestId("site-card").filter({ hasText: "Green Site" });
      const greenScore = greenCard.getByTestId("site-score");
      await expect(greenScore).toBeVisible();
      const greenColor = await greenScore.evaluate(
        (el) => window.getComputedStyle(el).color,
      );
      // GREEN = #16a34a → rgb(22, 163, 74)
      expect(greenColor).toBe("rgb(22, 163, 74)");

      const redCard = page.getByTestId("site-card").filter({ hasText: "Red Site" });
      const redScore = redCard.getByTestId("site-score");
      await expect(redScore).toBeVisible();
      const redColor = await redScore.evaluate(
        (el) => window.getComputedStyle(el).color,
      );
      // RED = #dc2626 → rgb(220, 38, 38)
      expect(redColor).toBe("rgb(220, 38, 38)");
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("Recently changed feed is visible (mock data) when sites exist", async ({
    page,
  }) => {
    const u = await createTestUser("mon-rich-feed", "business");
    try {
      await seedMonitoredSite(u.id, {
        url: "https://feed-1.example.test",
        label: "Feed Site One",
        last_score: 84,
      });
      await seedMonitoredSite(u.id, {
        url: "https://feed-2.example.test",
        label: "Feed Site Two",
        last_score: 76,
      });

      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      const feed = page.getByTestId("recently-changed");
      await expect(feed).toBeVisible();
      await expect(feed).toContainText(/recently changed/i);
      // Boundary signal: feed labels its mock-data state explicitly
      await expect(feed).toContainText(/preview.*mock data|mock data/i);

      // At least one item rendered (mock derives entries from seeded sites)
      const items = page.getByTestId("recently-changed-item");
      expect(await items.count()).toBeGreaterThan(0);
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("free user sees upsell banner, NOT the grid", async ({ page }) => {
    const u = await createTestUser("mon-rich-free", "free");
    try {
      await loginViaUI(page, u.email);
      await page.goto("/dashboard/monitored");
      await page.waitForLoadState("networkidle");

      // Upsell banner is shown
      const upsell = page.getByTestId("monitored-upsell");
      await expect(upsell).toBeVisible();
      await expect(upsell).toContainText(/business plan|continuous monitoring/i);

      // Grid + KPI strip are NOT rendered for free users
      await expect(page.getByTestId("monitored-grid")).toHaveCount(0);
      await expect(page.getByTestId("kpi-strip")).toHaveCount(0);
    } finally {
      await deleteTestUser(u.id);
    }
  });
});
