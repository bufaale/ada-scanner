import type { Scan, ScanIssue } from "@/types/database";
import { WCAG_21_CRITERIA, type WcagCriterion } from "./criteria";

export type ConformanceLevel =
  | "supports"
  | "partially-supports"
  | "does-not-support"
  | "not-applicable"
  | "not-evaluated";

export const CONFORMANCE_LABEL: Record<ConformanceLevel, string> = {
  supports: "Supports",
  "partially-supports": "Partially Supports",
  "does-not-support": "Does Not Support",
  "not-applicable": "Not Applicable",
  "not-evaluated": "Not Evaluated",
};

export interface CriterionResult {
  criterion: WcagCriterion;
  conformance: ConformanceLevel;
  /** Issues that drove this conformance decision */
  relatedIssues: ScanIssue[];
  remarks: string;
}

/**
 * Compute conformance per WCAG criterion from raw scan issues.
 *
 * Logic:
 *  - If the criterion has no mapped axe rules → "not-evaluated" (needs human auditor)
 *  - If the scan ran but no matching issues found → "supports"
 *  - If matching issues exist:
 *     - Any critical or serious issue → "does-not-support"
 *     - Only moderate/minor issues → "partially-supports"
 */
export function computeConformance(
  scan: Scan,
  issues: ScanIssue[],
): CriterionResult[] {
  const scanCompleted = scan.status === "completed";

  return WCAG_21_CRITERIA.map((criterion): CriterionResult => {
    if (criterion.ruleIds.length === 0) {
      return {
        criterion,
        conformance: "not-evaluated",
        relatedIssues: [],
        remarks: "Requires manual testing (content-dependent criterion).",
      };
    }

    if (!scanCompleted) {
      return {
        criterion,
        conformance: "not-evaluated",
        relatedIssues: [],
        remarks: "Automated scan did not complete.",
      };
    }

    const related = issues.filter((issue) =>
      criterion.ruleIds.includes(issue.rule_id),
    );

    if (related.length === 0) {
      return {
        criterion,
        conformance: "supports",
        relatedIssues: [],
        remarks: "No violations detected by automated scan.",
      };
    }

    const hasBlocking = related.some(
      (i) => i.severity === "critical" || i.severity === "serious",
    );
    const conformance: ConformanceLevel = hasBlocking
      ? "does-not-support"
      : "partially-supports";

    const byRule = related.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.rule_id] = (acc[issue.rule_id] ?? 0) + 1;
      return acc;
    }, {});

    const remarks = Object.entries(byRule)
      .map(([rule, count]) => `${rule}: ${count} instance${count === 1 ? "" : "s"}`)
      .join("; ");

    return { criterion, conformance, relatedIssues: related, remarks };
  });
}

export function summarizeConformance(results: CriterionResult[]): Record<ConformanceLevel, number> {
  const summary: Record<ConformanceLevel, number> = {
    supports: 0,
    "partially-supports": 0,
    "does-not-support": 0,
    "not-applicable": 0,
    "not-evaluated": 0,
  };
  for (const r of results) summary[r.conformance] += 1;
  return summary;
}
