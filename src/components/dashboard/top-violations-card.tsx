"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FONT_DISPLAY = "var(--font-display), sans-serif";
const FONT_INTER = "var(--font-inter), sans-serif";
const FONT_MONO = "var(--font-mono), monospace";
const NAVY = "#0b1f3a";
const CYAN = "#06b6d4";
const SLATE_200 = "#e2e8f0";
const SLATE_500 = "#64748b";
const SLATE_50 = "#f8fafc";
const RED = "#dc2626";
const AMBER = "#f59e0b";

interface Violation {
  rule_id: string;
  count: number;
  severity: string;
  wcag_level: string | null;
  description: string | null;
}

function severityColor(severity: string) {
  switch (severity) {
    case "critical":
      return RED;
    case "serious":
      return AMBER;
    case "moderate":
      return "#facc15";
    default:
      return SLATE_500;
  }
}

export function TopViolationsCard() {
  const [data, setData] = useState<{ violations: Violation[]; scans_considered: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scans/top-violations?days=30&limit=5")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ violations: [], scans_considered: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  if (data.violations.length === 0) return null;

  return (
    <div
      data-testid="top-violations-card"
      style={{
        background: "#fff",
        border: `1px solid ${SLATE_200}`,
        borderRadius: 8,
        padding: 20,
        fontFamily: FONT_INTER,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: NAVY }}>
            Top violations · last 30 days
          </div>
          <div style={{ fontSize: 11.5, color: SLATE_500, marginTop: 2 }}>
            Across {data.scans_considered} scan{data.scans_considered === 1 ? "" : "s"}
          </div>
        </div>
        <Link
          href="/dashboard/scans"
          style={{ fontSize: 12, color: CYAN, fontWeight: 600 }}
        >
          See all scans →
        </Link>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {data.violations.map((v) => (
          <li
            key={v.rule_id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              background: SLATE_50,
              borderRadius: 6,
              marginBottom: 6,
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, flex: 1 }}>
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: severityColor(v.severity),
                  flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {v.rule_id}
              </span>
              {v.wcag_level && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "#e0f2fe", color: "#0369a1" }}>
                  {v.wcag_level}
                </span>
              )}
              <span style={{ fontSize: 12, color: SLATE_500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {v.description ?? ""}
              </span>
            </div>
            <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: severityColor(v.severity), fontSize: 14 }}>
              {v.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
