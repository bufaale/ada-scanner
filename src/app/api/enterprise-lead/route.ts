/**
 * POST /api/enterprise-lead
 *
 * Captures the /enterprise discovery form. Validates with Zod, stores in
 * Supabase via admin client (RLS-bypassing — table is service-role-only),
 * fires a notification email to the operator, returns 201.
 *
 * Rate-limited per-IP at 3 submissions / 24h to slow obvious abuse without
 * gating real procurement leads. We hash the IP before storing so the
 * downstream record is privacy-preserving.
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEnterpriseLeadNotification } from "@/lib/email/enterprise-lead";
import {
  EnterpriseLeadSchema,
  isDisposableEmail,
} from "@/lib/enterprise-lead/validate";
import { classifyBuyerLanguage } from "@/lib/buyer-language/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_HOURS = 24;
const RATE_MAX = 3;

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = EnterpriseLeadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid submission",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          msg: i.message,
        })),
      },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Block obviously-disposable email domains. Real procurement uses real
  // work email; gmail/proton/etc. is fine but throwaway domains aren't.
  if (isDisposableEmail(data.work_email)) {
    return NextResponse.json(
      {
        error:
          "Please use a work email address. We need to verify the procurement context before scheduling.",
      },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  const ipHash = ip ? sha256(ip + (process.env.IP_SALT ?? "")) : null;
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const referrer = req.headers.get("referer")?.slice(0, 500) ?? null;

  const supabase = createAdminClient();

  // Rate limit per IP — best-effort, table is the source of truth.
  if (ipHash) {
    const since = new Date(Date.now() - RATE_WINDOW_HOURS * 3_600_000).toISOString();
    const { count, error: countErr } = await supabase
      .from("enterprise_leads")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if (!countErr && (count ?? 0) >= RATE_MAX) {
      return NextResponse.json(
        {
          error:
            "Too many submissions from this network in the last 24 hours. Email enterprise@piposlab.com directly if this is a real procurement request.",
        },
        { status: 429 },
      );
    }
  }

  const { data: row, error } = await supabase
    .from("enterprise_leads")
    .insert({
      name: data.name,
      work_email: data.work_email,
      company: data.company,
      role: data.role || null,
      frameworks: data.frameworks,
      scope: data.scope || null,
      ip_hash: ipHash,
      user_agent: ua,
      referrer,
    })
    .select("id")
    .single();

  if (error || !row) {
    console.error("[enterprise-lead] insert failed", error);
    return NextResponse.json(
      { error: "Could not record submission. Try email instead." },
      { status: 500 },
    );
  }

  // Fire the notification email; don't fail the request if email is down.
  try {
    await sendEnterpriseLeadNotification({
      id: row.id,
      name: data.name,
      work_email: data.work_email,
      company: data.company,
      role: data.role || null,
      frameworks: data.frameworks,
      scope: data.scope || null,
      ip_hash: ipHash,
      referrer,
    });
  } catch (e) {
    console.error("[enterprise-lead] email failed", e);
  }

  // Classify the buyer's scope text into scanner-vs-infrastructure
  // language buckets for the IH-thread experiment (aryan_sinh follow-up,
  // May 10 2026). Fire-and-forget — never blocks the response. Scope can
  // be empty; classifier returns "unclear" gracefully.
  if (data.scope && data.scope.trim()) {
    classifyAndStore(supabase, row.id, data.scope).catch((e) => {
      console.error("[enterprise-lead] classify failed", e);
    });
  }

  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

async function classifyAndStore(
  supabase: ReturnType<typeof createAdminClient>,
  leadId: string,
  text: string,
): Promise<void> {
  const result = await classifyBuyerLanguage(text);
  await supabase
    .from("enterprise_leads")
    .update({
      language_bucket: result.bucket,
      language_keywords: result.keywords,
      language_evidence: result.evidence,
      classified_at: new Date().toISOString(),
    })
    .eq("id", leadId);
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const xreal = req.headers.get("x-real-ip");
  if (xreal) return xreal.trim();
  return null;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

