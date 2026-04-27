"use client";

import { useEffect, useState } from "react";

const FONT_DISPLAY = "var(--font-display), sans-serif";
const FONT_INTER = "var(--font-inter), sans-serif";
const FONT_MONO = "var(--font-mono), monospace";
const NAVY = "#0b1f3a";
const CYAN = "#06b6d4";
const RED = "#dc2626";
const AMBER = "#f59e0b";
const GREEN = "#10b981";
const SLATE_100 = "#f1f5f9";
const SLATE_200 = "#e2e8f0";
const SLATE_400 = "#94a3b8";
const SLATE_500 = "#64748b";

interface PourResp {
  scan_id: string;
  domain: string;
  compliance_score: number | null;
  pour_scores: { perceivable: number; operable: number; understandable: number; robust: number } | null;
}

const PRINCIPLES = [
  { key: "P", name: "Perceivable", desc: "Alt text, contrast, captions" },
  { key: "O", name: "Operable", desc: "Keyboard, focus, navigation" },
  { key: "U", name: "Understandable", desc: "Labels, language, errors" },
  { key: "R", name: "Robust", desc: "Parsing, ARIA, name/role/value" },
] as const;

function colorFor(score: number) {
  if (score >= 85) return GREEN;
  if (score >= 70) return AMBER;
  return RED;
}

export function WcagBreakdownCard() {
  const [data, setData] = useState<PourResp | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scans?limit=20")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const scans: { id: string; domain: string; compliance_score: number | null; pour_scores: PourResp["pour_scores"] }[] = d.scans ?? [];
        const latest = scans.find((s) => s.pour_scores);
        if (latest) {
          setData({
            scan_id: latest.id,
            domain: latest.domain,
            compliance_score: latest.compliance_score,
            pour_scores: latest.pour_scores,
          });
        } else {
          setData({ scan_id: "", domain: "", compliance_score: null, pour_scores: null });
        }
      })
      .catch(() => {
        if (!cancelled) setData({ scan_id: "", domain: "", compliance_score: null, pour_scores: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  if (!data.pour_scores) return null;

  const { perceivable, operable, understandable, robust } = data.pour_scores;
  const overall = data.compliance_score ?? Math.round((perceivable + operable + understandable + robust) / 4);
  const scoreByKey: Record<"P" | "O" | "U" | "R", number> = {
    P: perceivable,
    O: operable,
    U: understandable,
    R: robust,
  };

  return (
    <div
      data-testid="wcag-breakdown-card"
      style={{
        background: "#fff",
        border: `1px solid ${SLATE_200}`,
        borderRadius: 8,
        padding: 24,
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        gap: 32,
        alignItems: "stretch",
        fontFamily: FONT_INTER,
      }}
    >
      <Donut score={overall} domain={data.domain} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: NAVY }}>
          WCAG breakdown · POUR
        </div>
        {PRINCIPLES.map((p) => (
          <PrincipleRow key={p.key} name={p.name} desc={p.desc} score={scoreByKey[p.key as "P" | "O" | "U" | "R"]} />
        ))}
      </div>
    </div>
  );
}

function Donut({ score, domain }: { score: number; domain: string }) {
  const r = 64;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const color = colorFor(score);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 160, height: 160 }}>
        <svg viewBox="0 0 160 160" style={{ width: 160, height: 160, transform: "rotate(-90deg)" }}>
          <circle cx="80" cy="80" r={r} fill="none" stroke={SLATE_100} strokeWidth={10} />
          <circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeDasharray={c}
            strokeDashoffset={off}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 36, color, lineHeight: 1, letterSpacing: "-0.02em" }}>{score}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: SLATE_400, marginTop: 4, fontWeight: 600 }}>/ 100</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: SLATE_500, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
          Latest scan
        </div>
        <div style={{ fontSize: 12.5, color: NAVY, fontFamily: FONT_MONO, wordBreak: "break-all" }}>{domain || "—"}</div>
      </div>
    </div>
  );
}

function PrincipleRow({ name, desc, score }: { name: string; desc: string; score: number }) {
  const color = colorFor(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: NAVY }}>{name}</span>
          <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color }}>{score}</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: SLATE_100, overflow: "hidden", marginBottom: 4 }}>
          <div style={{ width: `${Math.max(0, Math.min(100, score))}%`, height: "100%", background: color }} />
        </div>
        <div style={{ fontSize: 11, color: SLATE_500 }}>{desc}</div>
      </div>
    </div>
  );
}
