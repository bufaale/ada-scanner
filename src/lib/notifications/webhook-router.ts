/**
 * Cross-app shared notification router. Apps copy this file to gain a
 * consistent way to send the same payload to multiple destinations
 * (Slack, Teams, Discord, generic Email) without rewriting per-channel
 * adapters in every app.
 *
 * Pattern:
 *  - Caller builds a `NotificationPayload` once.
 *  - Router reads the user's connected destinations from `notification_targets`
 *    (or env vars for system-level alerts) and fans out.
 *  - Each adapter is a small function that translates the payload to the
 *    destination's wire format.
 *
 * Failure semantics: one bad adapter must not block the others. Errors are
 * collected and returned alongside successes.
 */

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface NotificationPayload {
  /** Short, one-line title shown as the notification's headline. */
  title: string;
  /** Optional longer body. Markdown allowed for adapters that support it. */
  body?: string;
  /** Used for color/emoji per adapter. */
  level?: NotificationLevel;
  /** Optional structured fields rendered as a key-value list (Slack blocks etc.) */
  fields?: Array<{ label: string; value: string }>;
  /** Optional CTA button. */
  cta?: { label: string; url: string };
}

export interface Destination {
  type: "slack" | "teams" | "discord" | "email";
  /** Slack: incoming-webhook URL. Teams/Discord: same. Email: recipient address. */
  target: string;
  /** Email-only: optional from-address override. */
  from?: string;
}

export interface SendResult {
  destination: Destination;
  ok: boolean;
  error?: string;
}

// ---------- Slack ----------

const SLACK_LEVEL_COLOR: Record<NotificationLevel, string> = {
  info: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
};

export function buildSlackPayload(p: NotificationPayload): Record<string, unknown> {
  const color = SLACK_LEVEL_COLOR[p.level ?? "info"];
  const blocks: Array<Record<string, unknown>> = [
    { type: "header", text: { type: "plain_text", text: p.title.slice(0, 150) } },
  ];
  if (p.body) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: p.body.slice(0, 3_000) } });
  }
  if (p.fields && p.fields.length > 0) {
    blocks.push({
      type: "section",
      fields: p.fields.slice(0, 10).map((f) => ({
        type: "mrkdwn",
        text: `*${f.label}*\n${f.value}`,
      })),
    });
  }
  if (p.cta) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: p.cta.label },
          url: p.cta.url,
        },
      ],
    });
  }
  return {
    attachments: [{ color, blocks }],
  };
}

// ---------- Discord ----------

const DISCORD_LEVEL_COLOR: Record<NotificationLevel, number> = {
  info: 0x3b82f6,
  success: 0x10b981,
  warning: 0xf59e0b,
  error: 0xef4444,
};

export function buildDiscordPayload(p: NotificationPayload): Record<string, unknown> {
  const fields = (p.fields ?? []).slice(0, 10).map((f) => ({
    name: f.label,
    value: f.value,
    inline: true,
  }));
  return {
    embeds: [
      {
        title: p.title.slice(0, 256),
        description: p.body?.slice(0, 4_000),
        color: DISCORD_LEVEL_COLOR[p.level ?? "info"],
        fields,
        url: p.cta?.url,
      },
    ],
  };
}

// ---------- Teams ----------

export function buildTeamsPayload(p: NotificationPayload): Record<string, unknown> {
  const themeColor = SLACK_LEVEL_COLOR[p.level ?? "info"].replace("#", "");
  const sections: Array<Record<string, unknown>> = [];
  if (p.body) sections.push({ text: p.body });
  if (p.fields && p.fields.length > 0) {
    sections.push({
      facts: p.fields.map((f) => ({ name: f.label, value: f.value })),
    });
  }
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: p.title,
    themeColor,
    title: p.title,
    sections,
    potentialAction: p.cta
      ? [
          {
            "@type": "OpenUri",
            name: p.cta.label,
            targets: [{ os: "default", uri: p.cta.url }],
          },
        ]
      : undefined,
  };
}

// ---------- Send ----------

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

/**
 * Fan-out to every destination. Failures are collected, never thrown.
 * Email is intentionally NOT sent here — caller wires Resend (or its preferred
 * provider) for `type: "email"` because credential management varies per app.
 */
export async function sendNotification(
  payload: NotificationPayload,
  destinations: Destination[],
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const dest of destinations) {
    if (dest.type === "slack") {
      const r = await postJson(dest.target, buildSlackPayload(payload));
      results.push({ destination: dest, ...r });
    } else if (dest.type === "discord") {
      const r = await postJson(dest.target, buildDiscordPayload(payload));
      results.push({ destination: dest, ...r });
    } else if (dest.type === "teams") {
      const r = await postJson(dest.target, buildTeamsPayload(payload));
      results.push({ destination: dest, ...r });
    } else {
      // Email left to the host app.
      results.push({ destination: dest, ok: false, error: "email adapter not wired" });
    }
  }
  return results;
}
