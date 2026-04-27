"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ----- validation schemas -----
const profileDetailsSchema = z.object({
  full_name: z.string().trim().max(120).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(64).nullable().optional(),
  timezone: z.string().trim().max(80).nullable().optional(),
  avatar_url: z.string().trim().url().max(2048).nullable().optional().or(z.literal("")),
});

const notificationsSchema = z.object({
  scan_complete: z.boolean(),
  weekly_summary: z.boolean(),
  compliance_alerts: z.boolean(),
  marketing_emails: z.boolean(),
});

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Update profile details (name, company, country, timezone, avatar).
 *
 * Pattern: authenticate via getUser() (server-validated cookie session) FIRST,
 * then write via the service-role admin client. We do this because the
 * @supabase/ssr server client occasionally drops the auth header on writes
 * inside React Server Actions in Next.js 16 + Turbopack dev, which causes
 * RLS-protected updates to silently affect zero rows. Auth is still
 * verified — we only ever update the row matching the verified user.id.
 *
 * TODO: revisit once Next.js 16 stabilizes; the SSR client write path may
 * become reliable enough to drop the admin client here.
 */
export async function updateProfileDetails(
  input: z.infer<typeof profileDetailsSchema>,
): Promise<ProfileActionResult> {
  const parsed = profileDetailsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Coerce empty strings to null so we don't store empty values.
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]),
  );

  const admin = createAdminClient();
  // Update the existing profile row (handle_new_user trigger creates it on
  // signup). If the row doesn't exist (rare race), we don't create it from
  // the action — the FK to auth.users could fail if the user was just
  // deleted, and we don't want to resurrect deleted accounts.
  const { error } = await admin
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings/profile");
  return { ok: true };
}

/**
 * Update notification preferences (jsonb column). See note on
 * updateProfileDetails about why we use the admin client for the write.
 */
export async function updateNotificationPreferences(
  input: z.infer<typeof notificationsSchema>,
): Promise<ProfileActionResult> {
  const parsed = notificationsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ notification_preferences: parsed.data })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/profile");
  return { ok: true };
}

/**
 * Send password reset email via Supabase Auth. The user receives a secure
 * link to set a new password.
 */
export async function sendPasswordResetEmail(): Promise<ProfileActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: "Unauthorized" };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "https://accessiscan.piposlab.com";
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${baseUrl}/auth/reset-password`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
