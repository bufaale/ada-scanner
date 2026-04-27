import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import type { NotificationPreferences } from "@/types/database";

export const metadata = {
  title: "Profile Settings - AccessiScan",
  description: "Manage your AccessiScan account, notifications, and security preferences.",
};

const FONT_DISPLAY = "var(--font-display), sans-serif";
const FONT_INTER = "var(--font-inter), sans-serif";
const NAVY = "#0b1f3a";
const SLATE_500 = "#64748b";

const DEFAULT_NOTIFS: NotificationPreferences = {
  scan_complete: true,
  weekly_summary: true,
  compliance_alerts: true,
  marketing_emails: false,
};

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // The user object's email_confirmed_at presence indicates verified.
  const userMeta = user as unknown as {
    email_confirmed_at?: string | null;
    last_sign_in_at?: string | null;
    created_at?: string | null;
    confirmed_at?: string | null;
  };
  const emailVerified = Boolean(userMeta.email_confirmed_at || userMeta.confirmed_at);
  const lastSignInAt = userMeta.last_sign_in_at ?? null;

  const profileRow = (profile ?? {}) as Record<string, unknown>;

  const notificationsRaw = profileRow.notification_preferences;
  const notifications: NotificationPreferences =
    notificationsRaw && typeof notificationsRaw === "object"
      ? { ...DEFAULT_NOTIFS, ...(notificationsRaw as Partial<NotificationPreferences>) }
      : DEFAULT_NOTIFS;

  const memberSince =
    (profileRow.created_at as string | undefined) ??
    userMeta.created_at ??
    new Date().toISOString();

  return (
    <div style={{ padding: "24px 28px 48px", maxWidth: 920, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 28,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: NAVY,
          }}
        >
          Profile settings
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: SLATE_500, maxWidth: 620, lineHeight: 1.55, fontFamily: FONT_INTER }}>
          Manage your AccessiScan account, sign-in methods, and how compliance reports are attributed to you.
        </p>
      </div>

      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        emailVerified={emailVerified}
        lastSignInAt={lastSignInAt}
        memberSince={memberSince}
        role={(profileRow.role as string) ?? "user"}
        plan={(profileRow.subscription_plan as string) ?? "free"}
        initial={{
          full_name: (profileRow.full_name as string) ?? "",
          avatar_url: (profileRow.avatar_url as string) ?? "",
          company: (profileRow.company as string) ?? "",
          country: (profileRow.country as string) ?? "",
          timezone: (profileRow.timezone as string) ?? "",
          notifications,
        }}
      />
    </div>
  );
}
