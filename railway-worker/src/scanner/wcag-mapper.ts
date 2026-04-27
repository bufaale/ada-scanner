export function getWcagLevel(tags: string[]): "A" | "AA" | "AAA" | null {
  // Check in order from most specific to least
  if (tags.some(t => /wcag2?1?a{3}$/i.test(t) || t === "wcag2aaa" || t === "wcag21aaa")) return "AAA";
  if (tags.some(t => t === "wcag2aa" || t === "wcag21aa" || t === "wcag22aa")) return "AA";
  if (tags.some(t => t === "wcag2a" || t === "wcag21a")) return "A";
  return null; // best-practice or untagged
}

export type Principle = "P" | "O" | "U" | "R";

// WCAG numbering: 1.x.x Perceivable, 2.x.x Operable, 3.x.x Understandable,
// 4.x.x Robust. axe-core surfaces tags like `wcag111` (1.1.1) so we read
// the first numeric digit after the `wcag` (and optional `2`/`21`/`22`) prefix.
export function getWcagPrinciple(tags: string[]): Principle | null {
  const pattern = /^wcag2?1?2?2?(\d)\d{2}$/i;
  for (const t of tags) {
    const m = t.match(pattern);
    if (!m) continue;
    switch (m[1]) {
      case "1":
        return "P";
      case "2":
        return "O";
      case "3":
        return "U";
      case "4":
        return "R";
    }
  }
  return null;
}

export function getSeverityOrder(impact: string): number {
  switch (impact) {
    case "critical":
      return 0;
    case "serious":
      return 1;
    case "moderate":
      return 2;
    case "minor":
      return 3;
    default:
      return 4;
  }
}
