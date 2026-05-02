import crypto from "node:crypto";

/**
 * Build a Stripe-compatible webhook payload + signature header.
 *
 * Stripe signs `${timestamp}.${rawBody}` with HMAC-SHA256 using the webhook
 * secret, then sends the header as `t=<unix>,v1=<hex sig>`.
 *
 * Usage:
 *   const evt = makeStripeEvent({ id: "evt_test_1", type: "...", data: {...} });
 *   const { body, signature } = signStripeEvent(evt, secret);
 *   await fetch(url, { method: "POST", headers: { "Stripe-Signature": signature }, body });
 */
export interface StripeEventLike {
  id: string;
  object?: "event";
  api_version?: string | null;
  created?: number;
  type: string;
  livemode?: boolean;
  pending_webhooks?: number;
  request?: { id: string | null; idempotency_key: string | null } | null;
  data: { object: Record<string, unknown> };
}

export function makeStripeEvent(
  partial: Partial<StripeEventLike> & Pick<StripeEventLike, "id" | "type" | "data">,
): StripeEventLike {
  return {
    object: "event",
    api_version: "2024-09-30.acacia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: null,
    ...partial,
  };
}

export function signStripeEvent(
  event: StripeEventLike,
  secret: string,
  opts: { timestamp?: number } = {},
): { body: string; signature: string; timestamp: number } {
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const body = JSON.stringify(event);
  const signedPayload = `${timestamp}.${body}`;
  const sig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return {
    body,
    signature: `t=${timestamp},v1=${sig}`,
    timestamp,
  };
}

/**
 * Build a Stripe.Subscription-shaped object suitable for webhook event data.
 * Only the fields the AccessiScan webhook handler reads are populated.
 */
export function makeSubscription(opts: {
  id: string;
  userId: string;
  customer?: string;
  priceId: string;
  status: "active" | "past_due" | "unpaid" | "canceled" | "incomplete";
  cancelAtPeriodEnd?: boolean;
}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  const monthFromNow = now + 30 * 24 * 60 * 60;
  return {
    id: opts.id,
    object: "subscription",
    customer: opts.customer ?? `cus_test_${opts.userId}`,
    metadata: { supabase_user_id: opts.userId },
    status: opts.status,
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    items: {
      object: "list",
      data: [
        {
          id: `si_test_${opts.id}`,
          price: { id: opts.priceId, object: "price" },
          current_period_start: now,
          current_period_end: monthFromNow,
        },
      ],
    },
    current_period_start: now,
    current_period_end: monthFromNow,
  };
}
