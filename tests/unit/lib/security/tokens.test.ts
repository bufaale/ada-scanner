import { describe, it, expect } from "vitest";
import {
  generatePortalToken,
  generateTimedToken,
  signState,
  verifyState,
} from "@/lib/security/tokens";

describe("generatePortalToken", () => {
  it("returns a 43-char base64url string (256 bits = 32 bytes)", () => {
    const t = generatePortalToken();
    expect(t.length).toBe(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never produces the same token twice across 1000 calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generatePortalToken());
    expect(set.size).toBe(1000);
  });

  it("characters distribute across the alphabet", () => {
    const sample = Array.from({ length: 200 }, () => generatePortalToken()).join("");
    const distinct = new Set(sample.split("")).size;
    expect(distinct).toBeGreaterThan(50);
  });
});

describe("generateTimedToken", () => {
  it("returns token + expiresAt", () => {
    const r = generateTimedToken();
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.expiresAt).toBeInstanceOf(Date);
  });

  it("default expiry is 60 minutes from now", () => {
    const before = Date.now();
    const r = generateTimedToken();
    const expiresInMs = r.expiresAt.getTime() - before;
    expect(expiresInMs).toBeGreaterThan(60 * 60 * 1000 - 5000);
    expect(expiresInMs).toBeLessThan(60 * 60 * 1000 + 5000);
  });

  it("custom expiry: 5 minutes", () => {
    const before = Date.now();
    const r = generateTimedToken(5);
    const expiresInMs = r.expiresAt.getTime() - before;
    expect(expiresInMs).toBeGreaterThan(5 * 60 * 1000 - 5000);
    expect(expiresInMs).toBeLessThan(5 * 60 * 1000 + 5000);
  });
});

describe("signState / verifyState — HMAC roundtrip (B6 fix)", () => {
  it("signs a payload and verifies it back to the original", () => {
    const payload = "user-id-abc-123";
    const signed = signState(payload);
    expect(verifyState(signed)).toBe(payload);
  });

  it("produces a `<encoded>.<sig>` shape (two base64url segments)", () => {
    const signed = signState("hello");
    const parts = signed.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("verifyState returns null for null/undefined/empty input", () => {
    expect(verifyState(null)).toBeNull();
    expect(verifyState(undefined)).toBeNull();
    expect(verifyState("")).toBeNull();
  });

  it("verifyState returns null for malformed (no dot)", () => {
    expect(verifyState("nodot")).toBeNull();
  });

  it("verifyState returns null for malformed (multiple dots)", () => {
    expect(verifyState("a.b.c")).toBeNull();
  });

  it("verifyState returns null when signature has been tampered", () => {
    const signed = signState("hello");
    const [encoded, sig] = signed.split(".");
    // Flip one character of the signature.
    const tamperedChar = sig[0] === "A" ? "B" : "A";
    const tampered = `${encoded}.${tamperedChar}${sig.slice(1)}`;
    expect(verifyState(tampered)).toBeNull();
  });

  it("verifyState returns null when payload has been tampered", () => {
    const signed = signState("hello");
    const [, sig] = signed.split(".");
    // Re-encode a different payload but reuse the same signature.
    const fakePayload = Buffer.from("attacker", "utf8").toString("base64url");
    const tampered = `${fakePayload}.${sig}`;
    expect(verifyState(tampered)).toBeNull();
  });

  it("verifyState returns null when signature length differs (timing-safe)", () => {
    const signed = signState("hello");
    const [encoded] = signed.split(".");
    expect(verifyState(`${encoded}.short`)).toBeNull();
    expect(verifyState(`${encoded}.${"a".repeat(200)}`)).toBeNull();
  });

  it("two different payloads produce different signatures", () => {
    const a = signState("user-a");
    const b = signState("user-b");
    expect(a).not.toBe(b);
    const [, sigA] = a.split(".");
    const [, sigB] = b.split(".");
    expect(sigA).not.toBe(sigB);
  });

  it("signing the same payload twice produces the same signature (deterministic HMAC)", () => {
    const a = signState("stable-payload");
    const b = signState("stable-payload");
    expect(a).toBe(b);
  });

  it("roundtrips payloads with non-ASCII / special characters", () => {
    const payload = "user:héllo/wörld?q=1&x=ñ";
    const signed = signState(payload);
    expect(verifyState(signed)).toBe(payload);
  });

  it("verifyState handles invalid base64url payload encoding gracefully", () => {
    // Force a payload that isn't valid base64url for the encoded segment.
    // Buffer.from("***", "base64url") doesn't throw — it returns garbage.
    // The function still survives because length check or sig mismatch will null it out.
    const result = verifyState("***.***");
    expect(result).toBeNull();
  });
});
