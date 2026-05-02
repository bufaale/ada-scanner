import { describe, it, expect } from "vitest";
import {
  computeConformance,
  summarizeConformance,
  CONFORMANCE_LABEL,
} from "@/lib/vpat/conformance";
import type { Scan, ScanIssue } from "@/types/database";

function buildScan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: "scan-1",
    user_id: "user-1",
    site_id: null,
    url: "https://example.com",
    domain: "example.com",
    status: "completed",
    scan_type: "quick",
    progress: 100,
    pages_scanned: 1,
    compliance_score: 90,
    level_a_score: 90,
    level_aa_score: 80,
    level_aaa_score: 70,
    pour_scores: null,
    total_issues: 0,
    critical_count: 0,
    serious_count: 0,
    moderate_count: 0,
    minor_count: 0,
    ai_summary: null,
    ai_recommendations: null,
    visual_score: null,
    visual_issues_count: 0,
    visual_ai_summary: null,
    raw_data: null,
    error_message: null,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    ...overrides,
  };
}

function buildIssue(overrides: Partial<ScanIssue> = {}): ScanIssue {
  return {
    id: "issue-1",
    scan_id: "scan-1",
    wcag_level: "A",
    severity: "serious",
    impact: null,
    rule_id: "image-alt",
    rule_description: "Images must have alt",
    help_url: null,
    html_snippet: null,
    selector: null,
    page_url: null,
    fix_suggestion: null,
    position: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeConformance", () => {
  it("returns one CriterionResult per WCAG criterion in the catalog", () => {
    const scan = buildScan();
    const r = computeConformance(scan, []);
    expect(r.length).toBeGreaterThan(40); // catalog has ~50 criteria
    // Every result has the required shape.
    for (const cr of r) {
      expect(cr).toHaveProperty("criterion");
      expect(cr).toHaveProperty("conformance");
      expect(cr).toHaveProperty("relatedIssues");
      expect(cr).toHaveProperty("remarks");
    }
  });

  it("returns 'not-evaluated' for criteria with no mapped axe rules", () => {
    const scan = buildScan();
    const r = computeConformance(scan, []);
    // 1.2.1 Audio-only and Video-only has no mapped rules
    const c121 = r.find((x) => x.criterion.id === "1.2.1");
    expect(c121).toBeDefined();
    expect(c121!.conformance).toBe("not-evaluated");
    expect(c121!.remarks).toMatch(/manual testing/i);
  });

  it("returns 'not-evaluated' for ALL criteria when scan did not complete", () => {
    const scan = buildScan({ status: "failed" });
    const r = computeConformance(scan, []);
    expect(r.every((x) => x.conformance === "not-evaluated")).toBe(true);
  });

  it("returns 'supports' when scan completed and no matching issues found", () => {
    const scan = buildScan();
    const r = computeConformance(scan, []);
    // 1.1.1 Non-text Content has rule "image-alt" mapped — no issues = supports.
    const c111 = r.find((x) => x.criterion.id === "1.1.1");
    expect(c111).toBeDefined();
    expect(c111!.conformance).toBe("supports");
    expect(c111!.relatedIssues).toEqual([]);
  });

  it("returns 'does-not-support' when a critical issue matches", () => {
    const scan = buildScan();
    const issue = buildIssue({ rule_id: "image-alt", severity: "critical" });
    const r = computeConformance(scan, [issue]);
    const c111 = r.find((x) => x.criterion.id === "1.1.1");
    expect(c111!.conformance).toBe("does-not-support");
    expect(c111!.relatedIssues).toHaveLength(1);
    expect(c111!.remarks).toContain("image-alt");
  });

  it("returns 'does-not-support' when a serious issue matches", () => {
    const scan = buildScan();
    const issue = buildIssue({ rule_id: "image-alt", severity: "serious" });
    const r = computeConformance(scan, [issue]);
    const c111 = r.find((x) => x.criterion.id === "1.1.1");
    expect(c111!.conformance).toBe("does-not-support");
  });

  it("returns 'partially-supports' when only moderate/minor issues match", () => {
    const scan = buildScan();
    const issue = buildIssue({ rule_id: "image-alt", severity: "moderate" });
    const r = computeConformance(scan, [issue]);
    const c111 = r.find((x) => x.criterion.id === "1.1.1");
    expect(c111!.conformance).toBe("partially-supports");
  });

  it("aggregates rule counts in remarks", () => {
    const scan = buildScan();
    const issues = [
      buildIssue({ id: "i1", rule_id: "image-alt", severity: "critical" }),
      buildIssue({ id: "i2", rule_id: "image-alt", severity: "critical" }),
      buildIssue({ id: "i3", rule_id: "image-alt", severity: "serious" }),
    ];
    const r = computeConformance(scan, issues);
    const c111 = r.find((x) => x.criterion.id === "1.1.1");
    expect(c111!.remarks).toBe("image-alt: 3 instances");
    expect(c111!.relatedIssues).toHaveLength(3);
  });

  it("does NOT pollute one criterion's results with another's rules", () => {
    const scan = buildScan();
    const issue = buildIssue({ rule_id: "label", severity: "critical" });
    const r = computeConformance(scan, [issue]);
    const c111 = r.find((x) => x.criterion.id === "1.1.1"); // image-alt
    expect(c111!.conformance).toBe("supports");
    const c131 = r.find((x) => x.criterion.id === "1.3.1"); // includes "label"
    expect(c131!.conformance).toBe("does-not-support");
  });
});

describe("summarizeConformance", () => {
  it("returns counts of every conformance level (zeros for empty)", () => {
    const summary = summarizeConformance([]);
    expect(summary).toEqual({
      supports: 0,
      "partially-supports": 0,
      "does-not-support": 0,
      "not-applicable": 0,
      "not-evaluated": 0,
    });
  });

  it("counts each conformance level correctly", () => {
    const scan = {
      status: "completed",
    } as Scan;
    const fakeResults = [
      { criterion: {} as never, conformance: "supports" as const, relatedIssues: [], remarks: "" },
      { criterion: {} as never, conformance: "supports" as const, relatedIssues: [], remarks: "" },
      { criterion: {} as never, conformance: "does-not-support" as const, relatedIssues: [], remarks: "" },
      { criterion: {} as never, conformance: "not-evaluated" as const, relatedIssues: [], remarks: "" },
      { criterion: {} as never, conformance: "partially-supports" as const, relatedIssues: [], remarks: "" },
    ];
    void scan;
    const summary = summarizeConformance(fakeResults);
    expect(summary.supports).toBe(2);
    expect(summary["does-not-support"]).toBe(1);
    expect(summary["not-evaluated"]).toBe(1);
    expect(summary["partially-supports"]).toBe(1);
  });
});

describe("CONFORMANCE_LABEL", () => {
  it("provides human-readable label for each level", () => {
    expect(CONFORMANCE_LABEL.supports).toBe("Supports");
    expect(CONFORMANCE_LABEL["partially-supports"]).toBe("Partially Supports");
    expect(CONFORMANCE_LABEL["does-not-support"]).toBe("Does Not Support");
    expect(CONFORMANCE_LABEL["not-applicable"]).toBe("Not Applicable");
    expect(CONFORMANCE_LABEL["not-evaluated"]).toBe("Not Evaluated");
  });
});
