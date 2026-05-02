/**
 * Integration test — Stripe webhook lifecycle against the deployed app.
 *
 * Asserts:
 *  1. signature rejection for: no header, bogus header, wrong secret
 *  2. idempotency — replay of the same event id returns duplicate:true
 *  3. customer.subscription.updated with status="past_due" KEEPS the paid
 *     plan (B1 fix — past_due no longer downgrades to free during dunning)
 *  4. customer.subscription.deleted resets plan to "free" + status="canceled"
 *
 * Lifecycle tests (3, 4) need a real STRIPE_WEBHOOK_SECRET to sign against
 * the deployed app's `getStripe().webhooks.constructEvent` call. They also
 * need a real test user. They skip cleanly when these are absent.
 */
import { test, expect } from "@playwright/test";
import {
  makeStripeEvent,
  signStripeEvent,
  makeSubscription,
} from "../helpers/stripe-webhook";
import { createTestUser, deleteTestUser, setUserPlan } from "../helpers/test-utils";

const BASE = process.env.TEST_BASE_URL || "https://app-04-ada-scanner.vercel.app";
const WEBHOOK_URL = `${BASE}/api/stripe/webhook`;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();

async function getProfile(userId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_plan,subscription_status`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_ANON_KEY!,
      },
    },
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

test.describe("Stripe webhook — signature rejection", () => {
  test("rejects request with no Stripe-Signature header (400)", async ({ request }) => {
    const event = makeStripeEvent({
      id: `evt_test_nosig_${Date.now()}`,
      type: "customer.subscription.updated",
      data: { object: { id: "sub_x" } },
    });
    const r = await request.post(WEBHOOK_URL, {
      data: JSON.stringify(event),
      headers: { "Content-Type": "application/json" },
    });
    expect(r.status()).toBe(400);
  });

  test("rejects request with bogus Stripe-Signature value (400)", async ({ request }) => {
    const event = makeStripeEvent({
      id: `evt_test_bogus_${Date.now()}`,
      type: "customer.subscription.updated",
      data: { object: { id: "sub_x" } },
    });
    const r = await request.post(WEBHOOK_URL, {
      data: JSON.stringify(event),
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=123,v1=deadbeef",
      },
    });
    expect(r.status()).toBe(400);
  });

  test("rejects signature signed with wrong secret (400)", async ({ request }) => {
    const event = makeStripeEvent({
      id: `evt_test_wrong_${Date.now()}`,
      type: "customer.subscription.updated",
      data: { object: { id: "sub_x" } },
    });
    const { body, signature } = signStripeEvent(event, "whsec_wrong_secret_definitely_not_prod");
    const r = await request.post(WEBHOOK_URL, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
    });
    expect(r.status()).toBe(400);
  });
});

// The lifecycle suite needs the real webhook secret to forge events the
// deployed app accepts. Skip the entire describe if it's unavailable.
test.describe(STRIPE_WEBHOOK_SECRET ? "Stripe webhook — lifecycle (signed)" : "Stripe webhook — lifecycle (skipped, no STRIPE_WEBHOOK_SECRET)", () => {
  test.skip(!STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET not set — skipping signed lifecycle tests");
  test.skip(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY, "Supabase env not set");

  // PRO monthly price id (from the prod env, captured client-side).
  const PRO_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID?.trim();

  test("idempotency — replaying same event id returns duplicate:true", async ({ request }) => {
    const eventId = `evt_test_idem_${Date.now()}`;
    const event = makeStripeEvent({
      id: eventId,
      type: "customer.subscription.updated",
      data: {
        object: makeSubscription({
          id: "sub_test_idem",
          userId: "00000000-0000-0000-0000-000000000000",
          priceId: PRO_MONTHLY_PRICE_ID || "price_dummy",
          status: "active",
        }),
      },
    });
    const { body, signature } = signStripeEvent(event, STRIPE_WEBHOOK_SECRET!);
    const headers = { "Content-Type": "application/json", "Stripe-Signature": signature };

    const first = await request.post(WEBHOOK_URL, { data: body, headers });
    expect(first.status()).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.received).toBe(true);

    // Re-sign with a fresh timestamp but SAME event id — the
    // stripe_events_processed unique constraint catches it.
    const replay = signStripeEvent(event, STRIPE_WEBHOOK_SECRET!);
    const second = await request.post(WEBHOOK_URL, {
      data: replay.body,
      headers: { "Content-Type": "application/json", "Stripe-Signature": replay.signature },
    });
    expect(second.status()).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.duplicate).toBe(true);
  });

  test("past_due status keeps the paid plan (B1 fix — no downgrade during dunning)", async ({ request }) => {
    test.skip(!PRO_MONTHLY_PRICE_ID, "NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID not set");

    const user = await createTestUser("webhook-pastdue", "pro");
    try {
      // Sanity — user is "pro" before the past_due event.
      const before = await getProfile(user.id);
      expect(before?.subscription_plan).toBe("pro");

      const event = makeStripeEvent({
        id: `evt_test_pastdue_${Date.now()}`,
        type: "customer.subscription.updated",
        data: {
          object: makeSubscription({
            id: `sub_test_pastdue_${Date.now()}`,
            userId: user.id,
            priceId: PRO_MONTHLY_PRICE_ID!,
            status: "past_due",
          }),
        },
      });
      const { body, signature } = signStripeEvent(event, STRIPE_WEBHOOK_SECRET!);
      const r = await request.post(WEBHOOK_URL, {
        data: body,
        headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
      });
      expect(r.status()).toBe(200);

      // CRITICAL ASSERTION — the plan stays "pro", status reflects past_due.
      // Pre-B1, this would have flipped subscription_plan to "free".
      const after = await getProfile(user.id);
      expect(after?.subscription_plan).toBe("pro");
      expect(after?.subscription_status).toBe("past_due");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("subscription.deleted resets plan to free + status canceled", async ({ request }) => {
    test.skip(!PRO_MONTHLY_PRICE_ID, "NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID not set");

    const user = await createTestUser("webhook-deleted", "pro");
    try {
      // Bump status to active first so we can verify the transition.
      await setUserPlan(user.id, "pro");

      const event = makeStripeEvent({
        id: `evt_test_deleted_${Date.now()}`,
        type: "customer.subscription.deleted",
        data: {
          object: makeSubscription({
            id: `sub_test_deleted_${Date.now()}`,
            userId: user.id,
            priceId: PRO_MONTHLY_PRICE_ID!,
            status: "canceled",
          }),
        },
      });
      const { body, signature } = signStripeEvent(event, STRIPE_WEBHOOK_SECRET!);
      const r = await request.post(WEBHOOK_URL, {
        data: body,
        headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
      });
      expect(r.status()).toBe(200);

      const after = await getProfile(user.id);
      expect(after?.subscription_plan).toBe("free");
      expect(after?.subscription_status).toBe("canceled");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
