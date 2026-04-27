import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, subscription_plan, subscription_status")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ subscription: null });
  }

  const stripe = getStripe();
  let sub: import("stripe").Stripe.Subscription;
  try {
    sub = (await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id,
    )) as unknown as import("stripe").Stripe.Subscription;
  } catch {
    return NextResponse.json({ subscription: null });
  }

  const item = sub.items.data[0];
  const recurring = item?.price?.recurring;
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end
    ?? null;
  const periodStart = (item as unknown as { current_period_start?: number })?.current_period_start
    ?? (sub as unknown as { current_period_start?: number }).current_period_start
    ?? null;

  return NextResponse.json({
    subscription: {
      id: sub.id,
      status: sub.status,
      current_period_end: periodEnd,
      current_period_start: periodStart,
      cancel_at_period_end: sub.cancel_at_period_end,
      cancel_at: sub.cancel_at,
      interval: recurring?.interval ?? null,
      interval_count: recurring?.interval_count ?? null,
      currency: item?.price?.currency ?? null,
      unit_amount: item?.price?.unit_amount ?? null,
    },
  });
}
