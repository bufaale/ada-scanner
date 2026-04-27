"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Scan } from "@/types/database";

const FONT_DISPLAY = "var(--font-display), sans-serif";
const FONT_INTER = "var(--font-inter), sans-serif";
const FONT_MONO = "var(--font-mono), monospace";
const NAVY = "#0b1f3a";
const CYAN = "#06b6d4";
const RED = "#dc2626";
const SLATE_50 = "#f8fafc";
const SLATE_100 = "#f1f5f9";
const SLATE_200 = "#e2e8f0";
const SLATE_300 = "#cbd5e1";
const SLATE_400 = "#94a3b8";
const SLATE_500 = "#64748b";

function statusPillStyle(status: Scan["status"]): { color: string; bg: string; label: string } {
  switch (status) {
    case "completed":
      return { color: "#16a34a", bg: "rgba(22,163,74,0.10)", label: "Completed" };
    case "analyzing":
      return { color: "#7c3aed", bg: "rgba(124,58,237,0.10)", label: "Analyzing" };
    case "crawling":
      return { color: "#2563eb", bg: "rgba(37,99,235,0.10)", label: "Crawling" };
    case "pending":
      return { color: SLATE_500, bg: SLATE_100, label: "Pending" };
    case "failed":
      return { color: RED, bg: "rgba(220,38,38,0.10)", label: "Failed" };
    default:
      return { color: SLATE_500, bg: SLATE_100, label: status };
  }
}

export default function ScanHistoryPage() {
  const router = useRouter();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "10" });
        if (search) params.set("domain", search);
        const res = await fetch(`/api/scans?${params}`);
        if (res.ok) {
          const data = await res.json();
          setScans(data.scans);
          setTotalPages(data.totalPages);
        }
      } catch {
        // silently fail — DashboardError pattern handled at higher pages
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "24px 28px 48px", color: NAVY }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.02em", color: NAVY, margin: 0 }}>
            Scan history
          </h1>
          <p style={{ fontSize: 13.5, color: SLATE_500, marginTop: 4, fontFamily: FONT_INTER }}>
            All your accessibility scans across every site you've tested.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/scans/new")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", fontSize: 14, fontWeight: 600, fontFamily: FONT_INTER, borderRadius: 6, background: NAVY, color: "#fff", border: "none", cursor: "pointer" }}
        >
          + New scan
        </button>
      </div>

      <div style={{ maxWidth: 360 }}>
        <input
          type="text"
          placeholder="Filter by domain..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: "100%", height: 40, padding: "0 14px", border: `1px solid ${SLATE_200}`, borderRadius: 6, fontSize: 13.5, fontFamily: FONT_INTER, color: NAVY, background: "#fff", outline: "none" }}
        />
      </div>

      {loading ? (
        <div style={{ background: "#fff", border: `1px solid ${SLATE_200}`, borderRadius: 8, padding: 48, textAlign: "center", color: SLATE_500, fontFamily: FONT_INTER, fontSize: 13.5 }}>
          Loading scans...
        </div>
      ) : scans.length === 0 ? (
        <EmptyState
          searched={!!search}
          onNewScan={() => router.push("/dashboard/scans/new")}
        />
      ) : (
        <>
          <ScanTable
            scans={scans}
            onRowClick={(scan) => {
              if (scan.status === "completed") router.push(`/dashboard/scans/${scan.id}`);
            }}
          />
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: FONT_INTER, fontSize: 13 }}>
              <PaginationButton disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </PaginationButton>
              <span style={{ color: SLATE_500 }}>
                Page <span style={{ fontFamily: FONT_MONO, color: NAVY, fontWeight: 600 }}>{page}</span> of <span style={{ fontFamily: FONT_MONO, color: NAVY, fontWeight: 600 }}>{totalPages}</span>
              </span>
              <PaginationButton disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </PaginationButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ searched, onNewScan }: { searched: boolean; onNewScan: () => void }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${SLATE_200}`, borderRadius: 8, padding: 48, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: NAVY }}>
        {searched ? "No scans match your search" : "No scans yet"}
      </div>
      <p style={{ fontSize: 13, color: SLATE_500, marginTop: 6, marginBottom: 18, fontFamily: FONT_INTER }}>
        {searched
          ? "Try a different domain or clear the filter."
          : "Run your first accessibility scan to get started."}
      </p>
      <button
        type="button"
        onClick={onNewScan}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", fontSize: 14, fontWeight: 600, fontFamily: FONT_INTER, borderRadius: 6, background: NAVY, color: "#fff", border: "none", cursor: "pointer" }}
      >
        Run first scan
      </button>
    </div>
  );
}

function ScanTable({
  scans,
  onRowClick,
}: {
  scans: Scan[];
  onRowClick: (scan: Scan) => void;
}) {
  const headers = ["Score", "Domain", "URL", "Type", "Status", "Date", ""] as const;
  return (
    <div style={{ background: "#fff", border: `1px solid ${SLATE_200}`, borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT_INTER }}>
        <thead>
          <tr style={{ background: SLATE_50 }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: SLATE_500, fontWeight: 600, borderBottom: `1px solid ${SLATE_200}` }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scans.map((scan, i) => {
            const isLast = i === scans.length - 1;
            const score = scan.compliance_score;
            const pill = statusPillStyle(scan.status);
            const rowStyle: CSSProperties = {
              borderBottom: isLast ? 0 : `1px solid ${SLATE_100}`,
              cursor: scan.status === "completed" ? "pointer" : "default",
            };
            return (
              <tr key={scan.id} style={rowStyle} onClick={() => onRowClick(scan)} data-scan-id={scan.id}>
                <td style={{ padding: "14px 18px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: score === null ? SLATE_400 : score >= 80 ? NAVY : RED }}>
                  {score ?? "—"}
                </td>
                <td style={{ padding: "14px 18px", fontFamily: FONT_MONO, fontSize: 12.5, color: NAVY, fontWeight: 600 }}>
                  {scan.domain}
                </td>
                <td style={{ padding: "14px 18px", fontSize: 12, color: SLATE_500, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {scan.url}
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 4, background: scan.scan_type === "deep" ? "rgba(6,182,212,0.12)" : SLATE_100, color: scan.scan_type === "deep" ? CYAN : SLATE_500, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                    {scan.scan_type === "deep" ? "Deep" : "Quick"}
                  </span>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 9999, background: pill.bg, color: pill.color, fontSize: 11, fontWeight: 600 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: pill.color }} aria-hidden />
                    {pill.label}
                  </span>
                </td>
                <td style={{ padding: "14px 18px", fontSize: 12, color: SLATE_500, fontFamily: FONT_INTER }}>
                  {new Date(scan.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "14px 18px", textAlign: "right", color: SLATE_400, fontSize: 14 }}>
                  {scan.status === "completed" ? "→" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaginationButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ height: 32, padding: "0 12px", fontSize: 12.5, fontWeight: 600, fontFamily: FONT_INTER, borderRadius: 6, background: "#fff", color: disabled ? SLATE_400 : NAVY, border: `1px solid ${disabled ? SLATE_200 : SLATE_300}`, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}
