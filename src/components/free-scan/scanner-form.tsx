"use client";

import { useState } from "react";
import { Loader2, Search, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface FreeScanResponse {
  report: {
    url: string;
    fetched_status: number | null;
    issues: Array<{
      rule: string;
      severity: "critical" | "serious" | "moderate";
      count: number;
      example?: string;
      wcag_ref: string;
      fix_hint: string;
    }>;
    total_issue_count: number;
    health_score: number;
    error?: string;
  };
  share_token?: string;
  share_url?: string;
  email_captured?: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-rose-100 text-rose-900 border-rose-200",
  serious: "bg-amber-100 text-amber-900 border-amber-200",
  moderate: "bg-sky-100 text-sky-900 border-sky-200",
};

export function FreeScannerForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreeScanResponse | null>(null);

  // Post-result email capture — moved AFTER the scan ran so visitors see
  // value before giving up their email. The pre-result form was capturing
  // 0% (78 scans, 0 emails) because asking for email-up-front is too
  // friction-y when the visitor hasn't seen any score yet.
  const [claimEmail, setClaimEmail] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<"idle" | "sent" | "error" | "already">("idle");
  const [claimError, setClaimError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setClaimStatus("idle");
    setClaimEmail("");
    try {
      const res = await fetch("/api/free/wcag-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Scan failed");
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function onClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!result?.share_token || !claimEmail) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const r = await fetch(`/api/free/scan-result/${result.share_token}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: claimEmail }),
      });
      const data = await r.json();
      if (r.status === 409) {
        setClaimStatus("already");
        return;
      }
      if (!r.ok || !data?.ok) {
        setClaimError(typeof data?.error === "string" ? data.error : "Couldn't send the email — try again in a moment.");
        setClaimStatus("error");
        return;
      }
      setClaimStatus("sent");
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Network error");
      setClaimStatus("error");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">URL to scan</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com or https://example.com/page"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-[#0b1f3a] focus:outline-none focus:ring-1 focus:ring-[#0b1f3a]"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !url}
          className="inline-flex items-center gap-2 rounded-md bg-[#0b1f3a] px-4 py-2 text-sm font-medium text-white hover:bg-[#071428] disabled:opacity-50"
          data-testid="scan-submit"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <Search className="h-4 w-4" /> Scan now
            </>
          )}
        </button>
        <p className="text-xs text-slate-500">No signup. Results appear below in under 30 seconds.</p>
      </form>

      {error && (
        <div
          className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          role="alert"
          data-testid="scan-error"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-4" data-testid="scan-result">
          {result.report.error ? (
            // Fetch failed (403 / 404 / timeout / DNS). Don't show 0/100
            // because the user would think the site has zero accessibility.
            // Show an explicit blocked-by-host message + the option to try
            // the full Playwright-based scan which uses a real browser UA.
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" data-testid="scan-blocked">
              <div className="flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-5 w-5" />
                Couldn't scan this site
              </div>
              <p className="mt-2 break-all text-xs text-amber-800/80">{result.report.url}</p>
              <p className="mt-3">
                <span className="font-medium">{result.report.error}</span> — usually
                the site has a CDN (Cloudflare / Akamai / AWS WAF) that blocks
                automated requests. The lite scanner uses a server-to-server fetch
                that some sites reject.
              </p>
              <p className="mt-3">
                The full scan uses a real Chromium browser with a standard user
                agent and clears these blocks &gt;95% of the time.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-wide text-slate-500">Accessibility health</p>
                <p className="font-display text-3xl font-semibold text-[#0b1f3a]">
                  {result.report.health_score}/100
                </p>
              </div>
              <p className="mt-2 break-all text-xs text-slate-500">{result.report.url}</p>
            </div>
          )}

          {result.report.issues.length === 0 && !result.report.error ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              <CheckCircle className="mb-2 h-5 w-5" />
              No top-5 WCAG failures detected on the initial HTML response. The full
              Playwright-based scan checks ~80 more rules including color contrast,
              focus order, and JS-rendered content.
            </div>
          ) : (
            <ul className="space-y-3">
              {result.report.issues.map((iss, i) => (
                <li
                  key={i}
                  className={`rounded-lg border p-4 ${SEVERITY_COLOR[iss.severity]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        {iss.rule}
                      </div>
                      <p className="mt-1 text-xs opacity-80">{iss.wcag_ref}</p>
                    </div>
                    <span className="rounded-full border border-current px-2 py-0.5 text-xs font-medium">
                      {iss.count}× · {iss.severity}
                    </span>
                  </div>
                  <p className="mt-3 text-xs">{iss.fix_hint}</p>
                  {iss.example && (
                    <pre className="mt-2 overflow-x-auto rounded bg-white/60 p-2 text-[11px]">
                      <code>{iss.example}</code>
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* POST-RESULT EMAIL CAPTURE — moved here from pre-result form.
              Visitors now see their score before being asked for email. */}
          {result.share_token && claimStatus !== "sent" ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 p-5"
              data-testid="scan-claim-prompt"
            >
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                GET A COPY EMAILED
              </div>
              <h3 className="text-base font-semibold text-amber-950">
                Save this report + remediation tips
              </h3>
              <p className="mt-1 text-sm text-amber-900/90">
                We&apos;ll send you this scorecard, the top 5 fix hints, and a
                permalink you can share with your team. No newsletter, no signup.
              </p>
              <form onSubmit={onClaim} className="mt-3 flex flex-wrap gap-2">
                <input
                  type="email"
                  required
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value.slice(0, 254))}
                  placeholder="you@company.com"
                  data-testid="scan-claim-email"
                  className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={claiming || !claimEmail}
                  data-testid="scan-claim-submit"
                  className="inline-flex items-center gap-2 rounded-md bg-[#0b1f3a] px-4 py-2 text-sm font-medium text-white hover:bg-[#071428] disabled:opacity-50"
                >
                  {claiming ? "Sending…" : "Email me a copy"}
                </button>
              </form>
              {claimStatus === "error" && claimError ? (
                <p className="mt-2 text-xs text-rose-900" role="alert">
                  {claimError}
                </p>
              ) : null}
              {claimStatus === "already" ? (
                <p className="mt-2 text-xs text-amber-900">
                  This scan already has an email on file. Check your inbox.
                </p>
              ) : null}
            </div>
          ) : null}

          {claimStatus === "sent" ? (
            <div
              data-testid="scan-claim-sent"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            >
              ✓ Sent. Check{" "}
              <span className="font-medium">{claimEmail}</span> in a minute.
            </div>
          ) : null}

          <Link
            href="/signup"
            className="inline-flex items-center gap-1 rounded-md bg-[#0b1f3a] px-4 py-2 text-sm font-medium text-white hover:bg-[#071428]"
          >
            Run the full scan with VPAT export <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
