"use client";

import { useEffect, useState } from "react";

const FONT_DISPLAY = "var(--font-display), sans-serif";
const FONT_INTER = "var(--font-inter), sans-serif";
const FONT_MONO = "var(--font-mono), monospace";
const NAVY = "#0b1f3a";
const CYAN = "#06b6d4";
const RED = "#dc2626";
const GREEN = "#10b981";
const SLATE_100 = "#f1f5f9";
const SLATE_200 = "#e2e8f0";
const SLATE_400 = "#94a3b8";
const SLATE_500 = "#64748b";

type Range = 7 | 30 | 90;

interface Point {
  scan_id: string;
  domain: string;
  score: number | null;
  critical: number;
  serious: number;
  t: string;
}

const TARGET = 90;

export function ComplianceTrendCard() {
  const [range, setRange] = useState<Range>(30);
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    fetch(`/api/scans/trend?days=${range}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setPoints(d.points ?? []);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const series = (points ?? []).map((p) => p.score).filter((s): s is number => typeof s === "number");
  const last = series.length > 0 ? series[series.length - 1] : null;
  const first = series.length > 0 ? series[0] : null;
  const delta = last !== null && first !== null ? last - first : null;

  return (
    <div
      data-testid="compliance-trend-card"
      style={{
        background: "#fff",
        border: `1px solid ${SLATE_200}`,
        borderRadius: 8,
        padding: 24,
        fontFamily: FONT_INTER,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18, gap: 16 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: NAVY }}>
            Compliance trend
          </div>
          <div style={{ fontSize: 11.5, color: SLATE_500, marginTop: 2 }}>
            {points === null
              ? "Loading…"
              : series.length === 0
                ? "Run a scan to start tracking"
                : `${series.length} completed scan${series.length === 1 ? "" : "s"}`}
            {delta !== null && (
              <span style={{ marginLeft: 8, color: delta >= 0 ? GREEN : RED, fontWeight: 700, fontFamily: FONT_MONO }}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              data-testid={`trend-range-${r}`}
              style={{
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: FONT_INTER,
                border: `1px solid ${r === range ? NAVY : SLATE_200}`,
                background: r === range ? NAVY : "#fff",
                color: r === range ? "#fff" : SLATE_500,
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <TrendSvg data={series} />

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, fontSize: 11.5 }}>
        <Legend color={CYAN} label="Compliance score" />
        <Legend color={SLATE_400} dashed label={`Target (${TARGET})`} />
      </div>
    </div>
  );
}

function TrendSvg({ data }: { data: number[] }) {
  const w = 920;
  const h = 220;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  if (data.length < 2) {
    return (
      <div
        style={{
          height: h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: SLATE_400,
          fontSize: 13,
          background: SLATE_100,
          borderRadius: 6,
        }}
      >
        Need 2+ completed scans to render the trend
      </div>
    );
  }

  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * chartW);
  const ys = data.map((v) => padT + chartH - (v / 100) * chartH);
  const linePts = data.map((_, i) => `${xs[i]},${ys[i]}`).join(" ");
  const areaPts = `${padL},${padT + chartH} ${linePts} ${padL + chartW},${padT + chartH}`;
  const targetY = padT + chartH - (TARGET / 100) * chartH;
  const last = data.length - 1;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0, 25, 50, 75, 100].map((g) => {
        const y = padT + chartH - (g / 100) * chartH;
        return (
          <g key={g}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke={SLATE_100} strokeWidth={1} />
            <text x={padL - 8} y={y + 4} fontSize={10} textAnchor="end" fill={SLATE_400} fontFamily="var(--font-mono), monospace">
              {g}
            </text>
          </g>
        );
      })}
      <line
        x1={padL}
        y1={targetY}
        x2={padL + chartW}
        y2={targetY}
        stroke={SLATE_400}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <polygon points={areaPts} fill="rgba(6,182,212,0.10)" />
      <polyline points={linePts} fill="none" stroke={CYAN} strokeWidth={2} strokeLinejoin="round" />
      <circle cx={xs[last]} cy={ys[last]} r={5} fill={CYAN} />
      <circle cx={xs[last]} cy={ys[last]} r={9} fill="rgba(6,182,212,0.20)" />
    </svg>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: SLATE_500 }}>
      <span
        aria-hidden
        style={{
          width: 18,
          height: 2,
          background: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
