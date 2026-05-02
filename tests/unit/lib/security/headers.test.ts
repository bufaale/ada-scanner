import { describe, it, expect } from "vitest";
import { NextResponse, NextRequest } from "next/server";
import { setSecurityHeaders } from "@/lib/security/headers";

function buildResAndReq(pathname: string) {
  const url = `https://example.com${pathname}`;
  const req = new NextRequest(url);
  const res = NextResponse.next();
  return { req, res };
}

describe("setSecurityHeaders", () => {
  it("sets X-Frame-Options DENY (clickjacking)", () => {
    const { req, res } = buildResAndReq("/");
    const out = setSecurityHeaders(res, req);
    expect(out.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sets X-Content-Type-Options nosniff", () => {
    const { req, res } = buildResAndReq("/");
    const out = setSecurityHeaders(res, req);
    expect(out.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets Strict-Transport-Security with preload", () => {
    const { req, res } = buildResAndReq("/");
    const out = setSecurityHeaders(res, req);
    const hsts = out.headers.get("Strict-Transport-Security");
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("sets Referrer-Policy strict-origin-when-cross-origin", () => {
    const { req, res } = buildResAndReq("/");
    const out = setSecurityHeaders(res, req);
    expect(out.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("sets Permissions-Policy denying camera/microphone/etc and opting out of FLoC", () => {
    const { req, res } = buildResAndReq("/");
    const out = setSecurityHeaders(res, req);
    const pp = out.headers.get("Permissions-Policy")!;
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
    expect(pp).toContain("interest-cohort=()");
    expect(pp).toContain("payment=(self)");
  });

  it("sets Cross-Origin-Opener-Policy same-origin", () => {
    const { req, res } = buildResAndReq("/");
    const out = setSecurityHeaders(res, req);
    expect(out.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("sets Cross-Origin-Resource-Policy same-origin", () => {
    const { req, res } = buildResAndReq("/");
    const out = setSecurityHeaders(res, req);
    expect(out.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  it("sets X-XSS-Protection 1; mode=block (legacy)", () => {
    const { req, res } = buildResAndReq("/");
    const out = setSecurityHeaders(res, req);
    expect(out.headers.get("X-XSS-Protection")).toBe("1; mode=block");
  });

  it("does NOT cache /api/ responses (no-store)", () => {
    const { req, res } = buildResAndReq("/api/scans");
    const out = setSecurityHeaders(res, req);
    expect(out.headers.get("Cache-Control")).toContain("no-store");
    expect(out.headers.get("Pragma")).toBe("no-cache");
  });

  it("does NOT set Cache-Control no-store on non-/api/ paths", () => {
    const { req, res } = buildResAndReq("/dashboard");
    const out = setSecurityHeaders(res, req);
    expect(out.headers.get("Cache-Control")).toBeNull();
  });
});

describe("Content-Security-Policy", () => {
  function getCSP(pathname = "/") {
    const { req, res } = buildResAndReq(pathname);
    return setSecurityHeaders(res, req).headers.get("Content-Security-Policy")!;
  }

  it("includes Stripe.js script source", () => {
    expect(getCSP()).toContain("https://js.stripe.com");
  });

  it("includes Vercel Analytics script source", () => {
    expect(getCSP()).toContain("https://va.vercel-scripts.com");
  });

  it("allows Supabase via wildcard for connect-src AND img-src", () => {
    const csp = getCSP();
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("wss://*.supabase.co");
  });

  it("allows Stripe API in connect-src", () => {
    expect(getCSP()).toContain("https://api.stripe.com");
  });

  it("sets frame-ancestors 'none' (defense in depth with X-Frame-Options)", () => {
    const csp = getCSP();
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("sets object-src 'none'", () => {
    expect(getCSP()).toContain("object-src 'none'");
  });

  it("sets base-uri 'self' (prevents <base> hijacking)", () => {
    expect(getCSP()).toContain("base-uri 'self'");
  });

  it("includes upgrade-insecure-requests directive", () => {
    expect(getCSP()).toContain("upgrade-insecure-requests");
  });

  it("allows 'unsafe-inline' for script-src (Next.js hydration requirement)", () => {
    const csp = getCSP();
    // Required for Next.js App Router hydration scripts
    expect(csp).toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("sets default-src 'self'", () => {
    expect(getCSP()).toContain("default-src 'self'");
  });

  it("allows form-action 'self' only", () => {
    expect(getCSP()).toContain("form-action 'self'");
  });
});
