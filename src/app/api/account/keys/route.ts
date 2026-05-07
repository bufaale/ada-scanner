import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
});

function generateKey() {
  const raw = crypto.randomBytes(32).toString("base64url");
  const plaintext = `as_${raw}`;
  const prefix = plaintext.slice(0, 12);
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, prefix, hash };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, label, prefix, last_used_at, revoked_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_plan")
    .eq("id", user.id)
    .single();
  const plan = (profile?.subscription_plan ?? "free").toLowerCase();
  if (plan !== "agency" && plan !== "business" && plan !== "team") {
    return NextResponse.json(
      { error: "API keys require the Agency, Business, or Team plan." },
      { status: 402 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: "API key limit is 10 active keys. Revoke one first." },
      { status: 402 },
    );
  }

  const { plaintext, prefix, hash } = generateKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      label: parsed.data.label,
      prefix,
      key_hash: hash,
    })
    .select("id, label, prefix, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ key: { ...data, plaintext } });
}
