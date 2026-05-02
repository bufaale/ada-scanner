import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { urlInputSchema, validateResolvedIP } from "@/lib/security/url-validator";

// Mock dns/promises so validateResolvedIP doesn't hit the network.
vi.mock("dns/promises", () => ({
  default: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

import dns from "dns/promises";

describe("urlInputSchema (SSRF input validation)", () => {
  it("accepts a basic https URL", () => {
    const r = urlInputSchema.safeParse("https://example.com");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("https://example.com");
  });

  it("auto-prepends https:// when missing", () => {
    const r = urlInputSchema.safeParse("example.com");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("https://example.com");
  });

  it("accepts http URLs", () => {
    const r = urlInputSchema.safeParse("http://example.com");
    expect(r.success).toBe(true);
  });

  it("rejects empty string", () => {
    const r = urlInputSchema.safeParse("");
    expect(r.success).toBe(false);
  });

  it("rejects URLs longer than 2048 chars", () => {
    const long = "https://example.com/" + "a".repeat(3000);
    const r = urlInputSchema.safeParse(long);
    expect(r.success).toBe(false);
  });

  it("rejects javascript: URLs (transformed to https://javascript:..., parses but hostname fails)", () => {
    // The transform prepends https:// to anything not starting with http(s)://,
    // turning "javascript:alert(1)" into "https://javascript:alert(1)" which
    // parses as https://javascript with port=alert(1) — the port isn't numeric,
    // so URL() throws and the protocol refine returns false.
    const r = urlInputSchema.safeParse("javascript:alert(1)");
    expect(r.success).toBe(false);
  });

  it("rejects localhost", () => {
    expect(urlInputSchema.safeParse("http://localhost").success).toBe(false);
    expect(urlInputSchema.safeParse("https://localhost:3000").success).toBe(false);
  });

  it("rejects 127.0.0.1 loopback", () => {
    const r = urlInputSchema.safeParse("http://127.0.0.1");
    expect(r.success).toBe(false);
  });

  it("rejects 10.x private range", () => {
    const r = urlInputSchema.safeParse("http://10.0.0.5");
    expect(r.success).toBe(false);
  });

  it("rejects 192.168.x private range", () => {
    const r = urlInputSchema.safeParse("http://192.168.1.1");
    expect(r.success).toBe(false);
  });

  it("rejects 172.16-31 private range", () => {
    expect(urlInputSchema.safeParse("http://172.16.0.1").success).toBe(false);
    expect(urlInputSchema.safeParse("http://172.20.0.1").success).toBe(false);
    expect(urlInputSchema.safeParse("http://172.31.0.1").success).toBe(false);
  });

  it("ACCEPTS 172.32.x (just outside private range)", () => {
    const r = urlInputSchema.safeParse("http://172.32.0.1");
    expect(r.success).toBe(true);
  });

  it("rejects 169.254.169.254 (cloud metadata IP)", () => {
    const r = urlInputSchema.safeParse("http://169.254.169.254");
    expect(r.success).toBe(false);
  });

  it("rejects metadata.google.internal", () => {
    const r = urlInputSchema.safeParse("http://metadata.google.internal");
    expect(r.success).toBe(false);
  });

  it("rejects ::1 IPv6 loopback", () => {
    const r = urlInputSchema.safeParse("http://[::1]");
    expect(r.success).toBe(false);
  });

  it("rejects hostnames with disallowed characters", () => {
    const r = urlInputSchema.safeParse("http://exa mple.com");
    expect(r.success).toBe(false);
  });

  it("trims whitespace", () => {
    const r = urlInputSchema.safeParse("  https://example.com  ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("https://example.com");
  });
});

describe("validateResolvedIP (DNS rebinding defense)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when DNS resolves only to public IPs", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["8.8.8.8"]);
    vi.mocked(dns.resolve6).mockRejectedValue(new Error("no AAAA"));
    expect(await validateResolvedIP("dns.google")).toBe(true);
  });

  it("returns false if any A record is private (loopback)", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["127.0.0.1"]);
    expect(await validateResolvedIP("evil.test")).toBe(false);
  });

  it("returns false if any A record is in 10.x", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["8.8.8.8", "10.0.0.5"]);
    expect(await validateResolvedIP("dual.test")).toBe(false);
  });

  it("returns false if AAAA record is ::1", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["8.8.8.8"]);
    vi.mocked(dns.resolve6).mockResolvedValue(["::1"]);
    expect(await validateResolvedIP("ipv6loop.test")).toBe(false);
  });

  it("returns false if DNS resolution fails entirely", async () => {
    vi.mocked(dns.resolve4).mockRejectedValue(new Error("ENOTFOUND"));
    expect(await validateResolvedIP("nonexistent.test")).toBe(false);
  });

  it("tolerates missing AAAA when A is public", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["1.1.1.1"]);
    vi.mocked(dns.resolve6).mockRejectedValue(new Error("no AAAA"));
    expect(await validateResolvedIP("ipv4only.test")).toBe(true);
  });
});
