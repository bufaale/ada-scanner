"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const FONT_DISPLAY = "var(--font-display), sans-serif";
const FONT_INTER = "var(--font-inter), sans-serif";
const FONT_MONO = "var(--font-mono), ui-monospace, monospace";
const NAVY = "#0b1f3a";
const RED = "#dc2626";
const RED_700 = "#b91c1c";
const SLATE_200 = "#e2e8f0";
const SLATE_300 = "#cbd5e1";
const SLATE_500 = "#64748b";
const CYAN_50 = "#ecfeff";
const CYAN_500 = "#06b6d4";

const DOJ_TARGET_MS = new Date("2027-04-26T00:00:00Z").getTime();

function calcDaysRemaining(): number {
  return Math.max(0, Math.round((DOJ_TARGET_MS - Date.now()) / 86400000));
}

function DojDeadlineStrip() {
  // Render a stable initial value on the server (computed at module load) and
  // update once mounted on the client. Avoids hydration mismatch from clock skew.
  const [days, setDays] = useState<number>(() => calcDaysRemaining());

  useEffect(() => {
    setDays(calcDaysRemaining());
    // Re-compute every minute — a daily countdown doesn't need 1s precision.
    const id = setInterval(() => setDays(calcDaysRemaining()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-label="Federal accessibility deadline countdown"
      style={{
        background: RED,
        color: "#fff",
        fontFamily: FONT_INTER,
        fontSize: 13,
        fontWeight: 500,
        textAlign: "center",
        padding: "10px 16px",
        borderRadius: 8,
        letterSpacing: "0.005em",
        lineHeight: 1.45,
      }}
    >
      <strong style={{ fontWeight: 700 }}>
        Federal accessibility deadline:
      </strong>{" "}
      April 26, 2027
      <span aria-hidden="true" style={{ margin: "0 8px", opacity: 0.7 }}>
        ·
      </span>
      <span
        data-testid="doj-days-remaining"
        style={{
          fontFamily: FONT_MONO,
          fontFeatureSettings: '"tnum" 1',
          fontWeight: 700,
          color: NAVY,
          background: "#fff",
          padding: "1px 8px",
          borderRadius: 4,
          marginRight: 6,
        }}
      >
        {days}
      </span>
      days remaining
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <>
      <DojDeadlineStrip />
      <div style={{ background: "#fff", border: `1px solid ${SLATE_200}`, borderRadius: 8, padding: 32, fontFamily: FONT_INTER, marginTop: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, lineHeight: 1.1, letterSpacing: "-0.02em", color: NAVY, margin: 0 }}>
          Reset your password
        </h1>
        <p style={{ fontSize: 13, color: SLATE_500, marginTop: 8 }}>
          Enter your email and we&apos;ll send a secure link to set a new one.
        </p>
      </div>

      {success ? (
        <div role="status" style={{ padding: 16, borderRadius: 6, background: CYAN_50, border: `1px solid ${CYAN_500}`, fontSize: 13, color: NAVY }}>
          Check your email for the reset link. The link expires in 1 hour.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div role="alert" style={{ padding: "10px 12px", background: "rgba(220,38,38,0.08)", border: `1px solid ${RED}`, borderRadius: 6, fontSize: 13, color: RED_700 }}>
              {error}
            </div>
          )}

          <label htmlFor="forgot-email" style={{ display: "block" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>
              Email
            </span>
            <input
              id="forgot-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", height: 44, padding: "0 14px", border: `1px solid ${SLATE_200}`, borderRadius: 6, fontSize: 14, fontFamily: FONT_INTER, color: NAVY, background: "#fff", outline: "none" }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", height: 44, fontSize: 14, fontWeight: 600, fontFamily: FONT_INTER, borderRadius: 6, background: loading ? SLATE_300 : NAVY, color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Sending reset link..." : "Send reset link"}
          </button>
        </form>
      )}

      <p style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: SLATE_500 }}>
        Remember your password?{" "}
        <Link href="/login" style={{ color: NAVY, fontWeight: 600, textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
      </div>
    </>
  );
}
