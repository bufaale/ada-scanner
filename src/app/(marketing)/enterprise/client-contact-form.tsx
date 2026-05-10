"use client";

/**
 * Enterprise discovery-call form.
 *
 * Posts to /api/enterprise-lead which: validates with Zod, stores in
 * Supabase `enterprise_leads`, and emails enterprise@piposlab.com via
 * Resend so the operator gets a real-time ping.
 *
 * Intentionally light — name + email + company + obligation framework
 * + free-text scope. No "company size" dropdowns or "budget range"
 * fields; those are SDR shortcuts that filter out real buyers who
 * haven't decided yet.
 */

import { useState, useTransition } from "react";

const FONT_INTER = "var(--font-inter), sans-serif";
const FONT_MONO = "var(--font-mono), monospace";
const CYAN = "#06b6d4";
const NAVY_DEEP = "#050d1c";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

const FRAMEWORKS = [
  { id: "doj_title_ii", label: "DOJ Title II (US public entities)" },
  { id: "section_508", label: "Section 508 (US federal contractors)" },
  { id: "eaa", label: "European Accessibility Act (EU)" },
  { id: "aoda", label: "AODA (Ontario, Canada)" },
  { id: "acaa", label: "ACAA (US federal aviation)" },
  { id: "other", label: "Other / not yet determined" },
];

export function EnterpriseContactForm() {
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? ""),
      work_email: String(data.get("work_email") ?? ""),
      company: String(data.get("company") ?? ""),
      role: String(data.get("role") ?? ""),
      frameworks: FRAMEWORKS.filter((f) => data.get(`fw_${f.id}`) === "on").map(
        (f) => f.id,
      ),
      scope: String(data.get("scope") ?? ""),
    };

    if (
      !payload.name.trim() ||
      !payload.work_email.trim() ||
      !payload.company.trim()
    ) {
      setState({
        status: "error",
        message: "Name, email, and company are required.",
      });
      return;
    }

    setState({ status: "submitting" });
    startTransition(async () => {
      try {
        const res = await fetch("/api/enterprise-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            status: "error",
            message:
              body?.error ??
              "Couldn't submit right now. Try emailing enterprise@piposlab.com directly.",
          });
          return;
        }
        setState({ status: "success" });
        form.reset();
      } catch {
        setState({
          status: "error",
          message:
            "Network error. Try emailing enterprise@piposlab.com directly.",
        });
      }
    });
  }

  if (state.status === "success") {
    return (
      <div
        style={{
          background: "rgba(6,182,212,0.08)",
          border: "1px solid rgba(6,182,212,0.40)",
          borderRadius: 12,
          padding: 32,
          fontFamily: FONT_INTER,
          color: "#fff",
        }}
      >
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: CYAN,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          ── request received
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>
          Thanks. You&apos;ll get a calendar link from{" "}
          <strong style={{ color: CYAN }}>enterprise@piposlab.com</strong>{" "}
          within one business day. If your timeline is tighter than that,
          email us directly and we&apos;ll move it up.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        padding: 32,
        fontFamily: FONT_INTER,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
      aria-busy={pending}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: CYAN,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        ── procurement review request
      </div>

      <Row>
        <Field label="Name" name="name" autoComplete="name" required />
        <Field
          label="Work email"
          name="work_email"
          type="email"
          autoComplete="email"
          required
        />
      </Row>
      <Row>
        <Field
          label="Company / organization"
          name="company"
          autoComplete="organization"
          required
        />
        <Field
          label="Your role"
          name="role"
          placeholder="Compliance VP, CIO, Procurement Lead…"
          autoComplete="organization-title"
        />
      </Row>

      <fieldset
        style={{
          border: "0",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <legend
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
            fontFamily: FONT_MONO,
            marginBottom: 4,
          }}
        >
          Frameworks you&apos;re evaluating against (check all that apply)
        </legend>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {FRAMEWORKS.map((f) => (
            <label
              key={f.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                fontSize: 13.5,
                color: "rgba(255,255,255,0.85)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                name={`fw_${f.id}`}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: CYAN,
                }}
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
            fontFamily: FONT_MONO,
          }}
        >
          Scope (optional · helps tailor the call)
        </span>
        <textarea
          name="scope"
          rows={4}
          placeholder="e.g. 12 web properties + 4 mobile apps. Looking for SAML SSO, Auto-Fix PRs into 8 GitHub repos, and a Section 508 attestation. Procurement timeline 4-6 weeks."
          style={{
            background: "#000",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 6,
            padding: "12px 14px",
            color: "#fff",
            fontSize: 14,
            lineHeight: 1.55,
            fontFamily: FONT_INTER,
            resize: "vertical",
          }}
        />
      </label>

      {state.status === "error" && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            color: "#fca5a5",
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.40)",
            borderRadius: 6,
            padding: "10px 14px",
          }}
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          height: 52,
          padding: "0 26px",
          fontSize: 15,
          fontWeight: 600,
          background: pending ? "rgba(6,182,212,0.55)" : CYAN,
          color: NAVY_DEEP,
          borderRadius: 8,
          border: "none",
          cursor: pending ? "wait" : "pointer",
          fontFamily: FONT_INTER,
          marginTop: 4,
        }}
      >
        {pending ? "Submitting…" : "Schedule a procurement review →"}
      </button>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          lineHeight: 1.55,
        }}
      >
        We&apos;ll only use this to schedule the call and send the quote. No
        sales sequence, no marketing list. By submitting you agree to our{" "}
        <a
          href="/privacy"
          style={{ color: "rgba(255,255,255,0.65)", textDecoration: "underline" }}
        >
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

function Field({ label, name, ...rest }: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          fontFamily: FONT_MONO,
        }}
      >
        {label}
      </span>
      <input
        name={name}
        style={{
          background: "#000",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 6,
          padding: "12px 14px",
          color: "#fff",
          fontSize: 14,
          fontFamily: FONT_INTER,
        }}
        {...rest}
      />
    </label>
  );
}
