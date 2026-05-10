/**
 * Enterprise-lead notification email.
 *
 * Fired from /api/enterprise-lead when the /enterprise discovery form is
 * submitted. Sends a high-signal HTML summary to the operator inbox so the
 * follow-up call gets booked within one business day.
 */

import { Resend } from "resend";

export interface EnterpriseLeadInput {
  id: string;
  name: string;
  work_email: string;
  company: string;
  role?: string | null;
  frameworks: string[];
  scope?: string | null;
  ip_hash?: string | null;
  referrer?: string | null;
}

const FRAMEWORK_LABELS: Record<string, string> = {
  doj_title_ii: "DOJ Title II (US public entities)",
  section_508: "Section 508 (US federal contractors)",
  eaa: "European Accessibility Act (EU)",
  aoda: "AODA (Ontario, Canada)",
  acaa: "ACAA (US federal aviation)",
  other: "Other / not yet determined",
};

export async function sendEnterpriseLeadNotification(
  input: EnterpriseLeadInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping enterprise lead email");
    return;
  }
  const from =
    process.env.RESEND_FROM_EMAIL ?? "AccessiScan <alerts@piposlab.com>";
  const to = process.env.ENTERPRISE_LEAD_TO ?? "alex@piposlab.com";

  const fwLabels = input.frameworks
    .map((id) => FRAMEWORK_LABELS[id] ?? id)
    .map((l) => `<li style="margin:0;padding:2px 0">${escapeHtml(l)}</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#0b1f3a;color:#ffffff;padding:18px 22px">
        <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.85;color:#06b6d4">AccessiScan · enterprise lead</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">${escapeHtml(input.company)}</div>
      </div>

      <div style="padding:22px">
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#64748b;width:120px">Name</td><td style="padding:8px 0;color:#0f172a;font-weight:500">${escapeHtml(input.name)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Work email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml(input.work_email)}" style="color:#0e7490">${escapeHtml(input.work_email)}</a></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Role</td><td style="padding:8px 0;color:#0f172a">${escapeHtml(input.role ?? "—")}</td></tr>
        </table>

        <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.10em;color:#64748b;font-weight:700;margin-bottom:8px">Frameworks</div>
          <ul style="margin:0;padding-left:18px;font-size:14px;color:#334155">${fwLabels || '<li style="color:#94a3b8;list-style:none;padding-left:0">(none selected)</li>'}</ul>
        </div>

        ${
          input.scope
            ? `<div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.10em;color:#64748b;font-weight:700;margin-bottom:8px">Scope</div>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap">${escapeHtml(input.scope)}</p>
              </div>`
            : ""
        }

        <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
          Lead ID: ${escapeHtml(input.id)}<br>
          Referrer: ${escapeHtml(input.referrer ?? "(direct)")}<br>
          IP hash: ${escapeHtml(input.ip_hash ?? "—")}
        </div>

        <div style="margin-top:22px">
          <a href="mailto:${escapeHtml(input.work_email)}?subject=Re%3A%20AccessiScan%20Enterprise%20%E2%80%94%20discovery%20call" style="display:inline-block;background:#06b6d4;color:#0b1f3a;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
            Reply to ${escapeHtml(input.name)}
          </a>
        </div>
      </div>
    </div>
  </body>
</html>`;

  // resend@6.x expects snake_case `reply_to`. The TypeScript types accept
  // `replyTo` too on some minor versions but the runtime drops it. Use the
  // documented field name to be safe.
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: `[Enterprise] ${input.company} · ${input.name}`,
    reply_to: input.work_email,
    html,
  } as Parameters<typeof resend.emails.send>[0]);

  // Resend SDK returns { data, error } — surface the error rather than
  // silently swallowing it. The caller wraps this in try/catch so an email
  // failure won't fail the form submission, but the operator will see the
  // root cause in Vercel function logs.
  if ("error" in result && result.error) {
    throw new Error(
      `Resend send failed: ${result.error.message ?? JSON.stringify(result.error)}`,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
