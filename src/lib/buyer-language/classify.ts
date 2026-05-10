/**
 * Buyer-language classifier.
 *
 * Inspired by aryan_sinh's diagnostic on the IH AccessiScan launch
 * thread (May 9-10, 2026): if procurement-led buyers describe the
 * product in "scanner" language even after reading /enterprise, the
 * name is anchoring them in the wrong mental category. If they shift
 * to "infrastructure" language, the page is doing its job.
 *
 * Two-stage classifier:
 *
 *   1) Fast keyword pass (regex). Free, deterministic. Handles the
 *      ~80% of cases where the prospect uses one vocabulary cleanly.
 *
 *   2) Slow LLM tie-break (Claude Haiku) for cases where keywords
 *      from BOTH buckets appear. ~$0.001/call, only fires on
 *      ambiguous text. Rare.
 *
 * Outputs are stored verbatim — including the matched keywords and a
 * 200-char evidence snippet — so we can audit and reclassify later.
 * The tally is defensible if anyone (including us, in 6 months) asks
 * "what made you call this 'infrastructure'?".
 */

import Anthropic from "@anthropic-ai/sdk";

export type LanguageBucket = "scanner" | "infrastructure" | "mixed" | "unclear";

export interface ClassifyResult {
  bucket: LanguageBucket;
  keywords: string[];
  evidence: string;
}

/**
 * Words / phrases that signal the buyer thinks of the product as a
 * checker tool — one-time scan, get a report, move on.
 *
 * Conservative list. We'd rather under-flag than over-flag — false
 * positives on this side undercount the "scanner" mental category
 * which is the side we're worried about anyway.
 */
const SCANNER_KEYWORDS = [
  "scanner",
  "scan tool",
  "scan a site",
  "scan our site",
  "audit tool",
  "checker",
  "lighthouse",
  "wave tool",
  "axe-core",
  "one-time audit",
  "one-off audit",
  "point-in-time",
  "snapshot scan",
];

/**
 * Words / phrases that signal the buyer is thinking about ongoing
 * operational infrastructure — continuous monitoring, audit trail,
 * remediation workflow, evidence package.
 *
 * Errs on the side of LOW recall — we want a strong positive signal,
 * not just any mention of "compliance".
 */
const INFRASTRUCTURE_KEYWORDS = [
  "continuous monitoring",
  "continuous compliance",
  "compliance infrastructure",
  "compliance platform",
  "audit trail",
  "audit-trail",
  "evidence package",
  "evidence trail",
  "ongoing remediation",
  "remediation workflow",
  "remediation pipeline",
  "auto-fix pr",
  "auto-fix pull request",
  "soc 2",
  "soc2",
  "msa",
  "dpa",
  "baa",
  "procurement review",
  "procurement-led",
  "governance program",
  "compliance posture",
  "risk reduction",
  "doj title ii",
  "section 508",
  "vpat",
];

interface BucketHit {
  bucket: "scanner" | "infrastructure";
  matched: string[];
}

function matchBucket(
  text: string,
  bucket: "scanner" | "infrastructure",
  keywords: readonly string[],
): BucketHit | null {
  const lower = text.toLowerCase();
  const matched = keywords.filter((kw) => lower.includes(kw));
  return matched.length > 0 ? { bucket, matched } : null;
}

function evidenceSnippet(text: string, allKeywords: string[]): string {
  // Find the first keyword in the text and return ~200 chars centered on
  // it. This is the verbatim quote that the operator (or a future Aryan)
  // can read to audit the classification.
  if (allKeywords.length === 0) return text.slice(0, 200);
  const lower = text.toLowerCase();
  const firstHit = allKeywords
    .map((kw) => ({ kw, idx: lower.indexOf(kw) }))
    .filter((h) => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx)[0];
  if (!firstHit) return text.slice(0, 200);
  const start = Math.max(0, firstHit.idx - 80);
  const end = Math.min(text.length, firstHit.idx + 120);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`.trim();
}

/**
 * LLM tie-breaker for ambiguous text. Only called when keywords from
 * BOTH buckets appear. Returns one of the four buckets.
 */
async function llmTieBreak(text: string): Promise<LanguageBucket> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No API key — degrade gracefully to "mixed", which is the literal
    // interpretation of "we found both vocabularies in the text".
    return "mixed";
  }

  const client = new Anthropic({ apiKey });
  const truncated = text.slice(0, 4_000);
  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 64,
    messages: [
      {
        role: "user",
        content: `Classify how this procurement-led buyer describes an accessibility-compliance product. Respond with ONE word only:

  scanner          — they treat it as a one-time scan or audit tool
  infrastructure   — they treat it as ongoing monitoring + remediation + audit-trail
  mixed            — both perspectives are clearly present
  unclear          — neither perspective is clearly present

Text:
"""
${truncated}
"""

Answer (one word):`,
      },
    ],
  });

  const block = resp.content[0];
  const raw = block?.type === "text" ? block.text : "";
  const word = raw.trim().toLowerCase().split(/\W+/)[0] ?? "";
  if (word === "scanner" || word === "infrastructure" || word === "mixed" || word === "unclear") {
    return word;
  }
  return "mixed";
}

export async function classifyBuyerLanguage(text: string): Promise<ClassifyResult> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return { bucket: "unclear", keywords: [], evidence: "" };
  }

  const scanHit = matchBucket(trimmed, "scanner", SCANNER_KEYWORDS);
  const infraHit = matchBucket(trimmed, "infrastructure", INFRASTRUCTURE_KEYWORDS);

  // Case 1: only scanner vocabulary
  if (scanHit && !infraHit) {
    return {
      bucket: "scanner",
      keywords: scanHit.matched,
      evidence: evidenceSnippet(trimmed, scanHit.matched),
    };
  }

  // Case 2: only infrastructure vocabulary
  if (infraHit && !scanHit) {
    return {
      bucket: "infrastructure",
      keywords: infraHit.matched,
      evidence: evidenceSnippet(trimmed, infraHit.matched),
    };
  }

  // Case 3: both — call the LLM tiebreaker
  if (scanHit && infraHit) {
    const allKeywords = [...scanHit.matched, ...infraHit.matched];
    const bucket = await llmTieBreak(trimmed);
    return {
      bucket,
      keywords: allKeywords,
      evidence: evidenceSnippet(trimmed, allKeywords),
    };
  }

  // Case 4: neither
  return {
    bucket: "unclear",
    keywords: [],
    evidence: trimmed.slice(0, 200),
  };
}

// Exported for unit tests + reuse from Pilotdeck cron when it copies
// this file across the apps-portfolio convention boundary.
export const _internals = {
  SCANNER_KEYWORDS,
  INFRASTRUCTURE_KEYWORDS,
  matchBucket,
  evidenceSnippet,
};
