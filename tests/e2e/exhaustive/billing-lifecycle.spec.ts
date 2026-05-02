/**
 * billing-lifecycle.spec.ts — full subscription lifecycle simulated via
 * service-role profile updates (avoids hitting Stripe Checkout in CI).
 *
 * Scenario:
 *  1. New user signs up → profile.subscription_plan = "free", status = "free".
 *  2. Operator simulates Stripe checkout success by updating profile to
 *     plan="pro", status="active". /settings/billing should reflect Pro.
 *  3. Operator simulates subscription.deleted by resetting plan="free",
 *     status="canceled". /settings/billing should show the free upsell again.
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
  setUserPlan,
  expectBillingTier,
} from "../../helpers/test-utils";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function setStatus(userId: string, status: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ subscription_status: status }),
  });
  if (!res.ok) throw new Error(`setStatus failed: ${await res.text()}`);
}

test.describe("Billing lifecycle — free → pro → canceled", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY, "Supabase env not set");

  test("free signup → upgrade simulation → /settings/billing reflects Pro → cancel → free upsell", async ({ page }) => {
    const u = await createTestUser("billing-lifecycle", "free");
    try {
      // 1. Free user logs in.
      await loginViaUI(page, u.email);
      await page.goto("/settings/billing");
      await page.waitForLoadState("networkidle");
      await expectBillingTier(page, "free");

      // 2. Simulate successful checkout — bump to Pro active.
      await setUserPlan(u.id, "pro");
      await page.reload();
      await page.waitForLoadState("networkidle");
      // Pro tier should now be visible somewhere on the page.
      await expect(page.getByText(/\bpro\b/i).first()).toBeVisible({ timeout: 10_000 });
      // Free upsell CTAs (Upgrade to Pro / Choose plan) should NOT dominate.
      const body = await page.locator("body").innerText();
      // Strong active-paid indicators: "Manage Subscription" / "Cancel"
      // / "Renewal" / "Active". Tolerate either.
      const hasPaidIndicator =
        /manage\s*subscription|cancel\s*subscription|next\s*renewal|billing\s*cycle|active/i.test(body);
      expect(hasPaidIndicator).toBe(true);

      // 3. Simulate subscription.deleted — back to free.
      await setUserPlan(u.id, "free");
      await setStatus(u.id, "canceled");
      await page.reload();
      await page.waitForLoadState("networkidle");
      // Either a "free" badge, or pricing CTAs reappear.
      await expect(page.getByText(/free/i).first()).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("past_due status keeps the paid plan visible (B1 grace period)", async ({ page }) => {
    const u = await createTestUser("billing-lifecycle-pastdue", "pro");
    try {
      await loginViaUI(page, u.email);

      // Flip to past_due — the B1 fix means subscription_plan stays "pro"
      // and the dashboard should still treat the user as a paying customer
      // (so they can fix their card without losing access mid-month).
      await setStatus(u.id, "past_due");
      await page.goto("/settings/billing");
      await page.waitForLoadState("networkidle");
      // Pro tier should still be visible.
      await expect(page.getByText(/\bpro\b/i).first()).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteTestUser(u.id);
    }
  });
});
