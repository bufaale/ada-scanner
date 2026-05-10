/**
 * Buyer-language threshold alert email.
 *
 * Fired exactly once when 10 distinct procurement-led prospects have
 * been classified into scanner-vs-infrastructure language buckets via
 * the /enterprise form pipeline. Aryan_sinh's diagnostic from the IH
 * thread (May 10 2026) — see project_aryan_sinh_followup_2026_05_10.md.
 *
 * Deduplication is handled by the caller via the `alerts_fired` table
 * (insert with PK = alert_name; second insert fails with 23505 and the
 * caller skips sending). This helper trusts the caller and just sends.
 */

import { Resend } from "resend";

export interface BucketTallyRow {
  bucket: "scanner" | "infrastructure" | "mixed" | "unclear";
  classified_count: number;
  distinct_prospects: number;
}

export interface SampleQuote {
  bucket: BucketTallyRow["bucket"];
  company: string;
  evidence: string;
}

export interface ThresholdInput {
  total_distinct: number;
  tally: BucketTallyRow[];
  sample_quotes: SampleQuote[];
}

const BUCKET_COLOR: Record<BucketTallyRow["bucket"], string> = {
  scanner: "#dc2626",
  infrastructure: "#0e7490",
  mixed: "#a16207",
  unclear: "#64748b",
};

const BUCKET_LABEL: Record<BucketTallyRow["bucket"], string> = {
  scanner: "Scanner-language",
  infrastructure: "Infrastructure-language",
  mixed: "Mixed",
  unclear: "Unclear",
};

export async function sendBuyerLanguageThresholdAlert(
  input: ThresholdInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping threshold alert");
    return;
  }
  const from =
    process.env.RESEND_FROM_EMAIL ?? "AccessiScan <alerts@piposlab.com>";
  const to = process.env.ENTERPRISE_LEAD_TO ?? "alex@piposlab.com";

  // Find the leading bucket — that's the headline answer for the IH
  // thread update.
  const sortedBuckets = [...input.tally].sort(
    (a, b) => b.distinct_prospects - a.distinct_prospects,
  );
  const leader = sortedBuckets[0];
  const headline = leader
    ? `${BUCKET_LABEL[leader.bucket]} is winning · ${leader.distinct_prospects} of ${input.total_distinct}`
    : "10 prospects classified";

  const tallyRows = sortedBuckets
    .map(
      (r) => `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">
        <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${BUCKET_COLOR[r.bucket]};margin-right:8px"></span>
        <strong style="color:${BUCKET_COLOR[r.bucket]}">${escapeHtml(BUCKET_LABEL[r.bucket])}</strong>
      </td>
      <td align="right" style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums">${r.distinct_prospects}</td>
      <td align="right" style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-variant-numeric:tabular-nums">${r.classified_count}</td>
    </tr>`,
    )
    .join("");

  const quoteRows = input.sample_quotes
    .slice(0, 6)
    .map(
      (q) => `<div style="margin:14px 0;padding:12px 14px;background:#f8fafc;border-left:3px solid ${BUCKET_COLOR[q.bucket]};border-radius:4px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.10em;color:${BUCKET_COLOR[q.bucket]};font-weight:700;margin-bottom:6px">
        ${escapeHtml(BUCKET_LABEL[q.bucket])} · ${escapeHtml(q.company)}
      </div>
      <div style="font-size:13px;color:#0f172a;line-height:1.55;font-style:italic">
        &ldquo;${escapeHtml(q.evidence)}&rdquo;
      </div>
    </div>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0f172a">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#0b1f3a;color:#ffffff;padding:22px 24px">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#06b6d4;font-weight:700">AccessiScan · buyer-language threshold</div>
        <div style="font-size:24px;font-weight:700;margin-top:4px">🎯 10 prospects classified</div>
        <div style="font-size:14px;color:rgba(255,255,255,.78);margin-top:8px">${escapeHtml(headline)}</div>
      </div>

      <div style="padding:24px">
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#334155">
          The buyer-language experiment from the IH thread (aryan_sinh, May 10 2026)
          has hit its threshold. Here&apos;s what the first 10 procurement-led
          prospects told us — verbatim.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:18px">
          <thead>
            <tr style="background:#f1f5f9">
              <th align="left" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.10em;color:#64748b">Bucket</th>
              <th align="right" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.10em;color:#64748b">Distinct prospects</th>
              <th align="right" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.10em;color:#64748b">Classifications</th>
            </tr>
          </thead>
          <tbody>${tallyRows}</tbody>
        </table>

        <div style="margin-top:28px">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.10em;color:#64748b;font-weight:700;margin-bottom:8px">Verbatim quotes — randomly sampled</div>
          ${quoteRows}
        </div>

        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0">
          <div style="font-size:13px;color:#334155;line-height:1.6">
            <strong>Decision time.</strong> If <em>infrastructure</em> is winning, the page is
            doing its job and the name is fine. If <em>scanner</em> is winning, the
            page is compensating forever and the rebrand is on the table.
          </div>
          <div style="margin-top:14px">
            <a href="https://www.indiehackers.com/post/doj-title-ii-hits-in-12-months-cities-quote-50k-per-audit-my-scanner-runs-from-19-mo-a534ad46d9" style="display:inline-block;background:#06b6d4;color:#0b1f3a;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
              Update the IH thread →
            </a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: `🎯 [Buyer-language threshold] ${headline}`,
    html,
  });

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
