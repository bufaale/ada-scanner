/**
 * AccessiScan public badge endpoint.
 *
 * GET /badge/{encoded-domain}            → SVG badge with current score
 * GET /badge/{encoded-domain}?format=js  → small JS that injects the badge
 *
 * The {domain} is URL-encoded (e.g. `accessiscan.piposlab.com` becomes
 * `accessiscan.piposlab.com`). Trust pages live at
 * /scan-result/{token} — the badge links there.
 *
 * Scoring source: the most recent `public_scan_results` row whose `url`
 * matches the domain (any scheme, any path stripped to host). If no
 * scan exists we return a neutral "unverified" badge.
 *
 * Use cases:
 *   1. Customers embed `<script src="https://accessiscan.piposlab.com/badge/<their-domain>?format=js"></script>`
 *      on their site — every render = one backlink to /scan-result/{token}.
 *   2. Pipo Labs portfolio sites (callspark, aicomply, piposlab.com) embed
 *      it on /trust pages to show their own portfolio scores.
 *
 * Cache: 5-min CDN cache so the badge updates within a scan cycle but
 * doesn't hammer the DB on every page load.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ReportShape {
  health_score?: number;
  total_issue_count?: number;
}

interface RowShape {
  id: string;
  url: string;
  report: ReportShape;
}

async function findLatestScan(domain: string): Promise<RowShape | null> {
  const admin = createAdminClient();
  // Match on suffix — we accept "example.com", "www.example.com",
  // "example.com/page", etc. Look for any scan whose URL hostname
  // matches the requested domain.
  const candidates = [
    `https://${domain}`,
    `https://www.${domain}`,
    `http://${domain}`,
  ];
  for (const url of candidates) {
    const { data } = await admin
      .from("public_scan_results")
      .select("id, url, report")
      .eq("url", url)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as RowShape;
  }
  // Last resort: ilike on host
  const { data: ilike } = await admin
    .from("public_scan_results")
    .select("id, url, report")
    .ilike("url", `%${domain}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (ilike as RowShape | null) ?? null;
}

function renderSvg(score: number | null, domain: string, token: string | null): string {
  const tone =
    score == null ? "neutral" : score >= 90 ? "good" : score >= 75 ? "warn" : "bad";
  const fill =
    tone === "good"
      ? "#15803d"
      : tone === "warn"
        ? "#a16207"
        : tone === "bad"
          ? "#b91c1c"
          : "#475569";
  const scoreLabel = score == null ? "—" : String(score);
  const subLabel = score == null ? "scan now" : "/ 100";
  // Width tuned for a 250×60 inline-block badge.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="60" viewBox="0 0 250 60" role="img" aria-label="AccessiScan WCAG score ${scoreLabel}/100 for ${domain}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="250" height="60" rx="8" fill="url(#bg)"/>
  <text x="14" y="22" font-family="system-ui,-apple-system,sans-serif" font-size="10" letter-spacing="1" fill="#94a3b8" font-weight="600">ACCESSISCAN · WCAG 2.1 AA</text>
  <text x="14" y="46" font-family="system-ui,-apple-system,sans-serif" font-size="22" fill="#fff" font-weight="700">${escapeXml(domain).slice(0, 22)}</text>
  <rect x="170" y="12" width="68" height="36" rx="6" fill="${fill}"/>
  <text x="204" y="32" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#fff" font-weight="800" text-anchor="middle">${scoreLabel}</text>
  <text x="204" y="44" font-family="system-ui,-apple-system,sans-serif" font-size="8" letter-spacing="0.5" fill="#fff" opacity="0.85" text-anchor="middle">${subLabel}</text>
</svg>`;
}

function renderJs(domain: string, score: number | null, token: string | null): string {
  const linkHref = token
    ? `https://accessiscan.piposlab.com/scan-result/${token}`
    : `https://accessiscan.piposlab.com/free/wcag-scanner?utm_source=badge&utm_medium=embed&utm_campaign=${encodeURIComponent(domain)}`;
  const svgUrl = `https://accessiscan.piposlab.com/badge/${encodeURIComponent(domain)}`;
  // Tiny IIFE: finds any data-accessiscan-badge node and injects the link.
  // Falls back to appending at script position if no anchor is found.
  return `(function(){
  var src='${svgUrl}';
  var href='${linkHref}';
  var alt='AccessiScan WCAG ${score == null ? "scan" : `${score}/100`} for ${domain.replace(/'/g, "\\'")}';
  function inject(target){
    var a=document.createElement('a');
    a.href=href; a.target='_blank'; a.rel='noopener';
    a.style.display='inline-block'; a.style.lineHeight='0';
    var img=document.createElement('img');
    img.src=src; img.alt=alt; img.width=250; img.height=60;
    img.style.display='block';
    a.appendChild(img);
    target.appendChild(a);
  }
  var anchors=document.querySelectorAll('[data-accessiscan-badge]');
  if(anchors.length){anchors.forEach(inject); return;}
  var scripts=document.getElementsByTagName('script');
  var self=scripts[scripts.length-1];
  var holder=document.createElement('span');
  self.parentNode.insertBefore(holder, self.nextSibling);
  inject(holder);
})();`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ domain: string }> }) {
  const { domain: encoded } = await ctx.params;
  const domain = decodeURIComponent(encoded).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
  if (!domain || domain.length > 200) {
    return new NextResponse("Invalid domain", { status: 400 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "svg";

  const row = await findLatestScan(domain);
  const score = row?.report.health_score ?? null;
  const token = row?.id ?? null;

  if (format === "js") {
    return new NextResponse(renderJs(domain, score, token), {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Default: SVG inline.
  return new NextResponse(renderSvg(score, domain, token), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
