import type { AxeResults } from "./axe-runner.js";
import { getWcagLevel, getWcagPrinciple, type Principle } from "./wcag-mapper.js";

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

export interface PourScores {
  perceivable: number;
  operable: number;
  understandable: number;
  robust: number;
}

export interface ScanScores {
  overall: number;
  levelA: number;
  levelAA: number;
  levelAAA: number;
  pour: PourScores;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  totalIssues: number;
}

export function calculateScores(results: AxeResults): ScanScores {
  let criticalCount = 0,
    seriousCount = 0,
    moderateCount = 0,
    minorCount = 0;

  // Count violations by severity (count unique nodes, not just rules)
  for (const v of results.violations) {
    const nodeCount = v.nodes.length;
    switch (v.impact) {
      case "critical":
        criticalCount += nodeCount;
        break;
      case "serious":
        seriousCount += nodeCount;
        break;
      case "moderate":
        moderateCount += nodeCount;
        break;
      case "minor":
        minorCount += nodeCount;
        break;
    }
  }

  const totalIssues = criticalCount + seriousCount + moderateCount + minorCount;

  // Overall score: based on weighted pass/violation ratio
  const passWeight = results.passes.reduce((sum, p) => sum + p.nodes.length, 0);
  const violationWeight = results.violations.reduce(
    (sum, v) => sum + v.nodes.length * (SEVERITY_WEIGHTS[v.impact] || 1),
    0,
  );
  const totalWeight = passWeight + violationWeight;
  const overall = totalWeight > 0 ? Math.round((passWeight / totalWeight) * 100) : 100;

  // Per-level scores
  const levelA = calculateLevelScore(results, "A");
  const levelAA = calculateLevelScore(results, "AA");
  const levelAAA = calculateLevelScore(results, "AAA");

  // POUR per-principle scores
  const pour: PourScores = {
    perceivable: calculatePrincipleScore(results, "P"),
    operable: calculatePrincipleScore(results, "O"),
    understandable: calculatePrincipleScore(results, "U"),
    robust: calculatePrincipleScore(results, "R"),
  };

  return {
    overall,
    levelA,
    levelAA,
    levelAAA,
    pour,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    totalIssues,
  };
}

function calculatePrincipleScore(results: AxeResults, principle: Principle): number {
  const passes = results.passes.filter((p) => getWcagPrinciple(p.tags) === principle);
  const violations = results.violations.filter((v) => getWcagPrinciple(v.tags) === principle);

  const passCount = passes.reduce((sum, p) => sum + p.nodes.length, 0);
  const violationCount = violations.reduce((sum, v) => sum + v.nodes.length, 0);
  const total = passCount + violationCount;

  return total > 0 ? Math.round((passCount / total) * 100) : 100;
}

function calculateLevelScore(results: AxeResults, level: "A" | "AA" | "AAA"): number {
  const levelPasses = results.passes.filter((p) => getWcagLevel(p.tags) === level);
  const levelViolations = results.violations.filter((v) => getWcagLevel(v.tags) === level);

  const passCount = levelPasses.reduce((sum, p) => sum + p.nodes.length, 0);
  const violationCount = levelViolations.reduce((sum, v) => sum + v.nodes.length, 0);
  const total = passCount + violationCount;

  return total > 0 ? Math.round((passCount / total) * 100) : 100;
}
