/**
 * Unit tests for the /api/enterprise-lead validation pipeline.
 *
 * Covers:
 *  - Zod schema accepts valid payloads
 *  - Zod schema rejects malformed / oversized payloads
 *  - frameworks default to empty array
 *  - email is normalised to lowercase + trimmed
 *  - isDisposableEmail correctly flags known throwaway domains
 *  - isDisposableEmail does NOT over-reject (gmail, proton, hey, fastmail)
 */
import { describe, it, expect } from "vitest";
import {
  EnterpriseLeadSchema,
  isDisposableEmail,
  DISPOSABLE_DOMAINS,
} from "@/lib/enterprise-lead/validate";

describe("EnterpriseLeadSchema — happy path", () => {
  it("accepts a minimal valid payload", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "Marcus Tanaka",
      work_email: "m.tanaka@northshore.co",
      company: "Northshore Health",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.frameworks).toEqual([]);
      expect(r.data.work_email).toBe("m.tanaka@northshore.co");
    }
  });

  it("accepts a fully populated payload", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "Andrea Lopez",
      work_email: "andrea@scale-ops.io",
      company: "Scale Ops",
      role: "VP Compliance",
      frameworks: ["doj_title_ii", "section_508"],
      scope: "12 web properties + 4 mobile apps; need SAML SSO + 8 GitHub repos under Auto-Fix.",
    });
    expect(r.success).toBe(true);
  });

  it("normalises email to lowercase + trims", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "Foo",
      work_email: "  USER@EXAMPLE.COM  ",
      company: "Acme",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.work_email).toBe("user@example.com");
  });

  it("trims name + company whitespace", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "   Daisy   ",
      work_email: "daisy@example.com",
      company: "  Pipo Labs  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Daisy");
      expect(r.data.company).toBe("Pipo Labs");
    }
  });

  it("accepts empty role + scope as empty strings", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "X",
      work_email: "x@example.com",
      company: "Y",
      role: "",
      scope: "",
    });
    expect(r.success).toBe(true);
  });

  it("accepts all 6 framework IDs", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "X",
      work_email: "x@example.com",
      company: "Y",
      frameworks: [
        "doj_title_ii",
        "section_508",
        "eaa",
        "aoda",
        "acaa",
        "other",
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("EnterpriseLeadSchema — rejects bad input", () => {
  it("rejects missing name", () => {
    const r = EnterpriseLeadSchema.safeParse({
      work_email: "x@example.com",
      company: "Y",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty name after trim", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "   ",
      work_email: "x@example.com",
      company: "Y",
    });
    expect(r.success).toBe(false);
  });

  it("rejects malformed email", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "X",
      work_email: "not-an-email",
      company: "Y",
    });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than 120 chars", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "x".repeat(121),
      work_email: "x@example.com",
      company: "Y",
    });
    expect(r.success).toBe(false);
  });

  it("rejects company longer than 180 chars", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "X",
      work_email: "x@example.com",
      company: "y".repeat(181),
    });
    expect(r.success).toBe(false);
  });

  it("rejects scope longer than 2000 chars (memory bomb guard)", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "X",
      work_email: "x@example.com",
      company: "Y",
      scope: "z".repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown framework id", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "X",
      work_email: "x@example.com",
      company: "Y",
      frameworks: ["doj_title_ii", "bogus"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects more than 6 frameworks", () => {
    const r = EnterpriseLeadSchema.safeParse({
      name: "X",
      work_email: "x@example.com",
      company: "Y",
      frameworks: [
        "doj_title_ii",
        "section_508",
        "eaa",
        "aoda",
        "acaa",
        "other",
        "other", // 7th — exceeds max
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects email longer than 254 chars (RFC 5321)", () => {
    const local = "a".repeat(245);
    const r = EnterpriseLeadSchema.safeParse({
      name: "X",
      work_email: `${local}@example.com`,
      company: "Y",
    });
    expect(r.success).toBe(false);
  });
});

describe("isDisposableEmail", () => {
  it("flags every domain in the explicit denylist", () => {
    for (const domain of DISPOSABLE_DOMAINS) {
      expect(isDisposableEmail(`anyone@${domain}`)).toBe(true);
    }
  });

  it("is case-insensitive on domain", () => {
    expect(isDisposableEmail("foo@MAILINATOR.com")).toBe(true);
    expect(isDisposableEmail("foo@MailInator.COM")).toBe(true);
  });

  it("does NOT flag mainstream personal email providers", () => {
    // These are real possibilities for an early-stage procurement officer
    // who emails from a personal account before looping in IT — we should
    // NOT reject them or we lose real buyers.
    for (const e of [
      "alice@gmail.com",
      "bob@protonmail.com",
      "carol@proton.me",
      "dan@hey.com",
      "eve@fastmail.com",
      "frank@outlook.com",
      "grace@icloud.com",
    ]) {
      expect(isDisposableEmail(e), `${e} should NOT be flagged`).toBe(false);
    }
  });

  it("does NOT flag work email addresses", () => {
    for (const e of [
      "compliance@city.gov",
      "vp@university.edu",
      "procurement@northshore.co",
      "legal@acme.health",
    ]) {
      expect(isDisposableEmail(e)).toBe(false);
    }
  });

  it("returns false on malformed email (no @)", () => {
    expect(isDisposableEmail("not-an-email")).toBe(false);
  });

  it("returns false on empty input", () => {
    expect(isDisposableEmail("")).toBe(false);
  });
});
