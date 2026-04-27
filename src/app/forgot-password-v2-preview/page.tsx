"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from "react";

// ============================================================
//  Tokens
// ============================================================
const C = {
  navy900: "#0b1f3a",
  navy950: "#071428",
  navy800: "#122c4f",
  cyan500: "#06b6d4",
  cyan400: "#22d3ee",
  cyan50: "#ecfeff",
  red600: "#dc2626",
  red700: "#b91c1c",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate900: "#0f172a",
} as const;

const F_DISPLAY = "var(--font-display), sans-serif";
const F_SANS = "var(--font-inter), sans-serif";
const F_MONO = "var(--font-mono), monospace";

// ============================================================
//  Icons
// ============================================================
type IconProps = { size?: number; sw?: number; style?: CSSProperties };

function IconShield({ size = 16, sw = 2.5, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}

function IconArrowLeft({ size = 14, sw = 2, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function IconArrowR({ size = 16, sw = 2, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function IconMail({ size = 16, sw = 2, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconCheckLine({ size = 38, sw = 2.5, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <polyline points="4 12.5 10 18.5 20 6.5" />
    </svg>
  );
}

function IconRefresh({ size = 16, sw = 2, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function IconSpinner({ size = 16, sw = 2, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: "fpv2-spin 700ms linear infinite", ...style }}
    >
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  );
}

function IconCheckSm({ size = 10, sw = 3, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}

// ============================================================
//  Brand mark
// ============================================================
function Brand() {
  return (
    <a
      href="#"
      aria-label="AccessiScan home"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        color: C.navy900,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          background: C.cyan500,
          borderRadius: 6,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
        }}
      >
        <IconShield size={16} sw={2.5} />
      </span>
      <span
        style={{
          fontFamily: F_DISPLAY,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "-0.01em",
        }}
      >
        AccessiScan
      </span>
    </a>
  );
}

// ============================================================
//  DOJ deadline strip (countdown)
// ============================================================
function formatCountdown(target: number, now: number): string {
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}

function DojStrip() {
  const target = useRef(new Date("2027-04-26T00:00:00Z").getTime());
  const [label, setLabel] = useState<string>(() => formatCountdown(target.current, Date.now()));

  useEffect(() => {
    const tick = () => setLabel(formatCountdown(target.current, Date.now()));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      style={{
        background: C.red600,
        color: "#fff",
        fontSize: 13,
        fontWeight: 500,
        textAlign: "center",
        padding: "10px 24px",
        letterSpacing: "0.005em",
        fontFamily: F_SANS,
      }}
    >
      <strong style={{ fontWeight: 700 }}>DOJ Title II deadline.</strong> Public entities &ge; 50,000 people &mdash;
      compliance required by April 26, 2027.
      <span
        style={{
          fontFamily: F_MONO,
          fontFeatureSettings: '"tnum" 1',
          fontWeight: 500,
          marginLeft: 8,
          opacity: 0.92,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ============================================================
//  Form primitives
// ============================================================
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: C.cyan500,
        margin: "0 0 16px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: F_SANS,
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.cyan500 }} />
      {children}
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: F_DISPLAY,
        fontSize: 36,
        lineHeight: 1.08,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        margin: "0 0 12px",
        color: C.navy900,
      }}
    >
      {children}
    </h2>
  );
}

function Subtitle({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 15,
        lineHeight: 1.55,
        color: C.slate600,
        margin: "0 0 28px",
        maxWidth: 380,
        fontFamily: F_SANS,
      }}
    >
      {children}
    </p>
  );
}

function EmailInput({
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  hasError,
}: {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  hasError: boolean;
}) {
  const [focus, setFocus] = useState(false);
  const borderColor = hasError ? C.red600 : focus ? C.navy900 : C.slate200;
  const ringColor = hasError ? "rgba(220,38,38,.08)" : "rgba(11,31,58,.08)";
  const iconColor = focus || hasError ? C.navy900 : C.slate400;
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type="email"
        name="email"
        autoComplete="email"
        required
        value={value}
        onChange={onChange}
        placeholder="you@agency.gov"
        aria-describedby={`${id}-error`}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={{
          width: "100%",
          height: 44,
          padding: "0 14px 0 38px",
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          background: "#fff",
          color: C.navy900,
          fontFamily: F_SANS,
          fontSize: 15,
          outline: "none",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          boxShadow: focus ? `0 0 0 3px ${ringColor}` : "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: iconColor,
          display: "inline-flex",
          pointerEvents: "none",
          transition: "color 150ms ease",
        }}
      >
        <IconMail size={16} sw={2} />
      </span>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  fullWidth = true,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  fullWidth?: boolean;
  href?: string;
}) {
  const [hover, setHover] = useState(false);
  const sharedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    padding: "0 20px",
    borderRadius: 8,
    fontFamily: F_SANS,
    fontWeight: 600,
    fontSize: 14.5,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
    textDecoration: "none",
    whiteSpace: "nowrap",
    background: hover && !disabled ? C.navy950 : C.navy900,
    color: "#fff",
    width: fullWidth ? "100%" : "auto",
    opacity: disabled ? 0.55 : 1,
  };
  if (href) {
    return (
      <a
        href={href}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={sharedStyle}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={sharedStyle}
    >
      {children}
    </button>
  );
}

function OutlineButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 44,
        padding: "0 20px",
        borderRadius: 8,
        fontFamily: F_SANS,
        fontWeight: 600,
        fontSize: 14.5,
        cursor: disabled ? "not-allowed" : "pointer",
        border: `1px solid ${hover && !disabled ? C.navy900 : C.slate300}`,
        background: hover && !disabled ? C.slate50 : "#fff",
        color: C.navy900,
        transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
        whiteSpace: "nowrap",
        width: "100%",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ============================================================
//  Initial state (form)
// ============================================================
function InitialState({
  email,
  setEmail,
  showError,
  setShowError,
  submitting,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  showError: boolean;
  setShowError: (v: boolean) => void;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fpv2-state-fade">
      <Eyebrow>ACCOUNT RECOVERY</Eyebrow>
      <Title>Reset your password.</Title>
      <Subtitle>
        Enter the email associated with your AccessiScan account and we&apos;ll send you a secure reset link. Links
        expire after 30 minutes.
      </Subtitle>

      <form id="reset-form" noValidate onSubmit={onSubmit}>
        <label
          htmlFor="email-input"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: C.navy900,
            marginBottom: 8,
            fontFamily: F_SANS,
          }}
        >
          Work email
        </label>
        <EmailInput
          id="email-input"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (showError) setShowError(false);
          }}
          hasError={showError}
        />
        {showError ? (
          <div
            id="email-input-error"
            role="alert"
            style={{
              color: C.red600,
              fontSize: 12.5,
              marginTop: 8,
              fontFamily: F_SANS,
            }}
          >
            Enter a valid email address.
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 12.5, color: C.slate500, fontFamily: F_SANS }}>
            We&apos;ll only email you about this reset.
          </span>
        </div>

        <div style={{ marginTop: 24 }}>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <IconSpinner size={16} sw={2} />
                Sending&hellip;
              </>
            ) : (
              <>
                Send reset link
                <IconArrowR size={16} sw={2} />
              </>
            )}
          </PrimaryButton>
        </div>
      </form>

      <div
        style={{
          marginTop: 24,
          paddingTop: 24,
          borderTop: `1px solid ${C.slate200}`,
          fontSize: 13.5,
          color: C.slate600,
          textAlign: "center",
          fontFamily: F_SANS,
        }}
      >
        Remember it?
        <a
          href="#"
          style={{
            color: C.navy900,
            fontWeight: 600,
            textDecoration: "none",
            marginLeft: 4,
          }}
        >
          Sign in
        </a>
      </div>
    </div>
  );
}

// ============================================================
//  Success state
// ============================================================
function SuccessState({
  email,
  resendRemaining,
  resending,
  onResend,
  onTryAgain,
}: {
  email: string;
  resendRemaining: number;
  resending: boolean;
  onResend: () => void;
  onTryAgain: () => void;
}) {
  const formatMS = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };
  const canResend = resendRemaining <= 0 && !resending;

  return (
    <div className="fpv2-state-fade">
      <div
        aria-hidden
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: C.cyan50,
          border: "1px solid rgba(6, 182, 212, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 0 24px",
          position: "relative",
        }}
      >
        <span
          aria-hidden
          style={{
            content: '""',
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            border: "1px solid rgba(6, 182, 212, 0.18)",
          }}
        />
        <span
          className="fpv2-check-anim"
          style={{ display: "inline-flex", color: C.cyan500 }}
        >
          <IconCheckLine size={38} sw={2.5} />
        </span>
      </div>

      <Eyebrow>RESET LINK SENT</Eyebrow>
      <Title>Check your email.</Title>
      <Subtitle>We sent a password reset link to:</Subtitle>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: C.slate50,
          border: `1px solid ${C.slate200}`,
          borderRadius: 8,
          fontFamily: F_MONO,
          fontSize: 13,
          color: C.navy900,
          margin: "8px 0 28px",
          maxWidth: "100%",
          wordBreak: "break-all",
        }}
      >
        <span style={{ display: "inline-flex", color: C.cyan500, flexShrink: 0 }}>
          <IconMail size={14} sw={2.25} />
        </span>
        <span>{email}</span>
      </div>

      <div
        style={{
          background: "#fff",
          border: `1px solid ${C.slate200}`,
          borderRadius: 8,
          padding: "18px 18px 16px",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.slate500,
            marginBottom: 12,
            fontFamily: F_SANS,
          }}
        >
          What happens next
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", counterReset: "fpv2step" }}>
          {[
            <>
              Open the email from <strong style={{ color: C.navy900, fontWeight: 600 }}>noreply@accessiscan.dev</strong>{" "}
              &mdash; check spam if it&apos;s not in your inbox within 2 minutes.
            </>,
            <>
              Click <strong style={{ color: C.navy900, fontWeight: 600 }}>Reset password</strong> in the email. The link
              expires in 30 minutes.
            </>,
            <>Choose a new password and you&apos;re back in.</>,
          ].map((node, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 12,
                padding: "8px 0",
                fontSize: 13.5,
                color: C.slate600,
                lineHeight: 1.5,
                fontFamily: F_SANS,
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: C.cyan50,
                  color: C.cyan500,
                  fontFamily: F_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              <span>{node}</span>
            </li>
          ))}
        </ol>
      </div>

      <div
        className="fpv2-success-actions"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <OutlineButton onClick={onResend} disabled={!canResend}>
          {resending ? (
            <>
              <IconSpinner size={16} sw={2} />
              Sending&hellip;
            </>
          ) : (
            <>
              <IconRefresh size={16} sw={2} />
              Resend link
            </>
          )}
        </OutlineButton>
        <PrimaryButton href="#">
          Back to sign in
          <IconArrowR size={16} sw={2} />
        </PrimaryButton>
      </div>

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 13,
          color: C.slate500,
          fontFamily: F_SANS,
        }}
      >
        {resendRemaining > 0 ? (
          <>
            Didn&apos;t get it? You can resend in{" "}
            <span style={{ fontFamily: F_MONO, color: C.slate600 }}>{formatMS(resendRemaining)}</span>.
          </>
        ) : (
          <>Didn&apos;t get it? Resend the link below.</>
        )}
      </div>

      <div
        style={{
          marginTop: 24,
          paddingTop: 24,
          borderTop: `1px solid ${C.slate200}`,
          fontSize: 13.5,
          color: C.slate600,
          textAlign: "center",
          fontFamily: F_SANS,
        }}
      >
        Wrong email?
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onTryAgain();
          }}
          style={{
            color: C.navy900,
            fontWeight: 600,
            textDecoration: "none",
            marginLeft: 4,
          }}
        >
          Try a different address
        </a>
      </div>
    </div>
  );
}

// ============================================================
//  Left panel
// ============================================================
function LeftPanel() {
  type Mode = "initial" | "success";
  const [mode, setMode] = useState<Mode>("initial");
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [showError, setShowError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendRemaining, setResendRemaining] = useState(0);

  // Resend countdown
  useEffect(() => {
    if (resendRemaining <= 0) return;
    const id = window.setInterval(() => {
      setResendRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendRemaining]);

  const isValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = email.trim();
    if (!isValid(v)) {
      setShowError(true);
      return;
    }
    setSubmitting(true);
    // eslint-disable-next-line no-console
    console.log("[forgot-password-v2-preview] submit", { email: v });
    window.setTimeout(() => {
      setSubmittedEmail(v);
      setSubmitting(false);
      setMode("success");
      setResendRemaining(30);
    }, 650);
  };

  const handleResend = () => {
    if (resendRemaining > 0 || resending) return;
    setResending(true);
    // eslint-disable-next-line no-console
    console.log("[forgot-password-v2-preview] resend", { email: submittedEmail });
    window.setTimeout(() => {
      setResending(false);
      setResendRemaining(30);
    }, 600);
  };

  const handleTryAgain = () => {
    setMode("initial");
    setShowError(false);
  };

  return (
    <section
      style={{
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "28px 56px 40px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Brand />
        <a
          href="#"
          aria-label="Back to sign in"
          style={{
            color: C.slate500,
            fontSize: 13,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "color 150ms ease",
            fontFamily: F_SANS,
          }}
        >
          <IconArrowLeft size={14} sw={2} />
          Back to sign in
        </a>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 0",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          {mode === "initial" ? (
            <InitialState
              email={email}
              setEmail={setEmail}
              showError={showError}
              setShowError={setShowError}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          ) : (
            <SuccessState
              email={submittedEmail}
              resendRemaining={resendRemaining}
              resending={resending}
              onResend={handleResend}
              onTryAgain={handleTryAgain}
            />
          )}
        </div>
      </div>

      <footer
        style={{
          marginTop: "auto",
          paddingTop: 24,
          fontSize: 11.5,
          color: C.slate500,
          lineHeight: 1.5,
          fontFamily: F_SANS,
        }}
      >
        <div>AccessiScan does not warrant legal compliance. Consult qualified counsel.</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
          {[
            { href: "#", label: "Privacy" },
            { href: "#", label: "Terms" },
            { href: "#", label: "Security" },
            { href: "mailto:support@accessiscan.dev", label: "Contact support" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{ color: C.slate500, textDecoration: "none" }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </section>
  );
}

// ============================================================
//  Right panel (social proof)
// ============================================================
function RightPanel() {
  return (
    <aside
      aria-label="Customer proof"
      className="fpv2-right"
      style={{
        background: C.navy900,
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        padding: "56px 64px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          opacity: 0.07,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: -180,
          right: -120,
          width: 520,
          height: 520,
          background: "radial-gradient(50% 50% at 50% 50%, rgba(6,182,212,0.20), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 520,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.cyan400,
            marginBottom: 28,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            fontFamily: F_SANS,
          }}
        >
          ADA TITLE II <span style={{ color: "rgba(255,255,255,0.35)" }}>&middot;</span> WCAG 2.1 AA{" "}
          <span style={{ color: "rgba(255,255,255,0.35)" }}>&middot;</span> VPAT 2.5
        </div>

        <div
          aria-hidden
          style={{
            fontFamily: F_DISPLAY,
            fontSize: 96,
            lineHeight: 0.5,
            color: C.cyan500,
            marginBottom: 18,
            height: 36,
          }}
        >
          &ldquo;
        </div>
        <blockquote
          style={{
            fontFamily: F_DISPLAY,
            fontSize: 28,
            lineHeight: 1.25,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            color: "#fff",
            margin: "0 0 28px",
          }}
        >
          AccessiScan opened a pull request that fixed 47 WCAG violations on our citizen portal &mdash; in under 4
          minutes. Procurement signed off the next morning.
        </blockquote>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 56,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: C.navy800,
              border: "1px solid rgba(255,255,255,0.12)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: F_DISPLAY,
              fontWeight: 600,
              fontSize: 14,
              color: C.cyan400,
              flexShrink: 0,
            }}
          >
            MR
          </div>
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                margin: 0,
                fontFamily: F_SANS,
              }}
            >
              Maya Rodriguez
            </p>
            <p
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
                margin: "2px 0 0",
                fontFamily: F_SANS,
              }}
            >
              Director of Digital Services &middot; City of Austin
            </p>
          </div>
        </div>

        <div
          aria-label="Compliance frameworks"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 36,
          }}
        >
          {["SOC 2 Type II", "Section 508", "EN 301 549", "FedRAMP-ready"].map((label) => (
            <span
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                border: "1px solid rgba(255,255,255,0.20)",
                borderRadius: 6,
                fontFamily: F_MONO,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.04em",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <span style={{ display: "inline-flex", color: C.cyan400 }}>
                <IconCheckSm size={10} sw={3} />
              </span>
              {label}
            </span>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 0,
            borderTop: "1px solid rgba(255,255,255,0.10)",
            marginTop: "auto",
            paddingTop: 28,
          }}
        >
          <div style={{ padding: "4px 0" }}>
            <div
              style={{
                fontFamily: F_DISPLAY,
                fontWeight: 700,
                fontSize: 36,
                lineHeight: 1.0,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              5,100<span style={{ color: C.cyan400 }}>+</span>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.4,
                fontFamily: F_SANS,
              }}
            >
              Federal ADA suits filed in 2025
            </div>
          </div>
          <div
            style={{
              padding: "4px 0 4px 28px",
              borderLeft: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div
              style={{
                fontFamily: F_DISPLAY,
                fontWeight: 700,
                fontSize: 36,
                lineHeight: 1.0,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              $1<span style={{ color: C.cyan400 }}>M</span>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.4,
                fontFamily: F_SANS,
              }}
            >
              FTC fine against accessiBe overlay
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
//  Page composition (matches HTML order: DOJ strip → shell)
// ============================================================
export default function ForgotPasswordV2PreviewPage() {
  return (
    <>
      <style>{`
        @keyframes fpv2-spin { to { transform: rotate(360deg); } }
        @keyframes fpv2-state-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fpv2-draw-check {
          from { stroke-dashoffset: 40; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .fpv2-state-fade { animation: fpv2-state-fade 320ms ease-out both; }
          .fpv2-check-anim svg {
            stroke-dasharray: 40;
            stroke-dashoffset: 0;
            animation: fpv2-draw-check 600ms ease-out 100ms both;
          }
        }
        @media (max-width: 960px) {
          .fpv2-shell { grid-template-columns: 1fr !important; }
          .fpv2-right { display: none !important; }
        }
        @media (max-width: 480px) {
          .fpv2-success-actions { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <DojStrip />
      <main
        className="fpv2-shell"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          minHeight: "calc(100vh - 40px)",
        }}
      >
        <LeftPanel />
        <RightPanel />
      </main>
    </>
  );
}
