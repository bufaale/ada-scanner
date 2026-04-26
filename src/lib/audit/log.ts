/**
 * Cross-app shared audit logging service. Apps copy this file + the
 * 00004_audit_events.sql migration to gain enterprise-grade audit trail.
 *
 * Usage:
 *
 *   await logAuditEvent({
 *     userId: user.id,
 *     eventType: "scan.created",
 *     resource: `scan:${scanId}`,
 *     summary: `Created scan for ${url}`,
 *     meta: { url, scan_id: scanId, depth: "deep" },
 *   });
 *
 * Pattern:
 *  - Inserts via service role (bypasses RLS so service code can always log)
 *  - Never throws — audit logging failure must NOT break the user action
 *  - For high-volume events, prefer batching via `logAuditEvents([...])`
 */

import { createAdminClient } from "@/lib/supabase/server";

export type ActorType = "user" | "system" | "webhook" | "cron" | "admin";

export interface AuditEventInput {
  userId: string;
  eventType: string;
  actorType?: ActorType;
  actorId?: string;
  resource?: string;
  summary?: string;
  meta?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

type LooseDb = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const supabase = createAdminClient() as unknown as LooseDb;
    await supabase.from("audit_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      actor_type: input.actorType ?? "user",
      actor_id: input.actorId ?? null,
      resource: input.resource ?? null,
      summary: input.summary ?? null,
      meta: input.meta ?? {},
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (err) {
    // Audit logging must never break the user action. Surface to console
    // for the host app's observability layer to pick up.
    // eslint-disable-next-line no-console
    console.error("audit log failed:", err);
  }
}

export async function logAuditEvents(inputs: AuditEventInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const supabase = createAdminClient() as unknown as LooseDb;
    await supabase.from("audit_events").insert(
      inputs.map((i) => ({
        user_id: i.userId,
        event_type: i.eventType,
        actor_type: i.actorType ?? "user",
        actor_id: i.actorId ?? null,
        resource: i.resource ?? null,
        summary: i.summary ?? null,
        meta: i.meta ?? {},
        ip_address: i.ipAddress ?? null,
        user_agent: i.userAgent ?? null,
      })),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("audit batch log failed:", err);
  }
}

/**
 * Pure helper: extract IP + user-agent from a Next.js Request to populate
 * the audit context without each caller re-implementing the header dance.
 */
export function extractAuditContext(headers: Headers): { ipAddress?: string; userAgent?: string } {
  const ipAddress =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    undefined;
  const userAgent = headers.get("user-agent") ?? undefined;
  return { ipAddress, userAgent };
}
