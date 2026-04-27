import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] });
  }

  const stripe = getStripe();
  const list = await stripe.invoices.list({
    customer: profile.stripe_customer_id,
    limit: 24,
  });

  const invoices = list.data.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amount_paid: inv.amount_paid,
    amount_due: inv.amount_due,
    currency: inv.currency,
    created: inv.created,
    period_start: inv.period_start,
    period_end: inv.period_end,
    hosted_invoice_url: inv.hosted_invoice_url,
    invoice_pdf: inv.invoice_pdf,
    description: inv.lines.data[0]?.description ?? null,
  }));

  return NextResponse.json({ invoices });
}
