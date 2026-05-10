/**
 * Unit tests for the buyer-language classifier.
 *
 * The LLM tie-break path is mocked so tests run offline. Pure-keyword
 * paths run end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Anthropic SDK BEFORE importing the classifier so the
// classifier picks up the mock when it instantiates a client. The
// llmTieBreak function is exported indirectly — we test its behaviour
// by feeding text that triggers both keyword buckets.
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  // The classifier does `new Anthropic({ apiKey })` — vi.fn() is not a
  // constructor by default. Use a class-shaped factory that returns the
  // mocked client on construction.
  class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts: unknown) {
      void _opts;
    }
  }
  return { default: MockAnthropic };
});

import { classifyBuyerLanguage } from "@/lib/buyer-language/classify";

beforeEach(() => {
  mockCreate.mockReset();
  // Set a fake API key so the classifier doesn't short-circuit to "mixed"
  // before calling the (mocked) SDK. Tests that want to assert the
  // missing-key fallback explicitly delete this in their own scope.
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
});

describe("classifyBuyerLanguage — empty + edge cases", () => {
  it("returns unclear for empty string", async () => {
    const r = await classifyBuyerLanguage("");
    expect(r.bucket).toBe("unclear");
    expect(r.keywords).toEqual([]);
  });

  it("returns unclear for whitespace-only", async () => {
    const r = await classifyBuyerLanguage("   \n\t  ");
    expect(r.bucket).toBe("unclear");
  });

  it("returns unclear for text with neither vocabulary", async () => {
    const r = await classifyBuyerLanguage(
      "Hi there, just asking about your product and pricing.",
    );
    expect(r.bucket).toBe("unclear");
    expect(r.keywords).toEqual([]);
    expect(r.evidence).toContain("just asking");
  });
});

describe("classifyBuyerLanguage — scanner-only language", () => {
  it("flags 'scanner' alone", async () => {
    const r = await classifyBuyerLanguage(
      "Looking for an accessibility scanner for our marketing site.",
    );
    expect(r.bucket).toBe("scanner");
    expect(r.keywords).toContain("scanner");
    expect(r.evidence.toLowerCase()).toContain("scanner");
  });

  it("flags 'one-time audit' phrasing", async () => {
    const r = await classifyBuyerLanguage(
      "We just need a one-time audit to check our site before the new launch.",
    );
    expect(r.bucket).toBe("scanner");
    expect(r.keywords).toContain("one-time audit");
  });

  it("flags 'point-in-time' + 'lighthouse' (both scanner)", async () => {
    const r = await classifyBuyerLanguage(
      "We currently use Lighthouse for a point-in-time check before each release.",
    );
    expect(r.bucket).toBe("scanner");
    expect(r.keywords.length).toBeGreaterThanOrEqual(2);
  });

  it("does not call the LLM when only scanner keywords match", async () => {
    await classifyBuyerLanguage("We need a scanner for our site.");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("classifyBuyerLanguage — infrastructure-only language", () => {
  it("flags 'continuous monitoring' + 'audit trail'", async () => {
    const r = await classifyBuyerLanguage(
      "We need continuous monitoring with an audit trail for our DOJ Title II obligations.",
    );
    expect(r.bucket).toBe("infrastructure");
    expect(r.keywords).toContain("continuous monitoring");
    expect(r.keywords).toContain("audit trail");
    expect(r.keywords).toContain("doj title ii");
  });

  it("flags 'compliance platform' + 'remediation workflow'", async () => {
    const r = await classifyBuyerLanguage(
      "Our team is evaluating a compliance platform with a remediation workflow.",
    );
    expect(r.bucket).toBe("infrastructure");
  });

  it("flags 'soc 2' + 'msa'", async () => {
    const r = await classifyBuyerLanguage(
      "Will need to see SOC 2 and review your MSA before any procurement review.",
    );
    expect(r.bucket).toBe("infrastructure");
  });

  it("does not call the LLM when only infrastructure keywords match", async () => {
    await classifyBuyerLanguage("Need continuous compliance + audit trail.");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("classifyBuyerLanguage — mixed language calls the LLM", () => {
  it("calls the LLM when both vocabularies appear", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "infrastructure" }],
    });

    const r = await classifyBuyerLanguage(
      "Started with a scanner approach but we really need continuous monitoring with an audit trail.",
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(r.bucket).toBe("infrastructure");
    // Both buckets' keywords show up in the evidence trail
    expect(r.keywords).toContain("scanner");
    expect(r.keywords).toContain("continuous monitoring");
  });

  it("respects 'mixed' verdict from LLM", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "mixed" }],
    });

    const r = await classifyBuyerLanguage(
      "We use a scanner today but exploring a compliance platform.",
    );
    expect(r.bucket).toBe("mixed");
  });

  it("falls back to 'mixed' when LLM returns garbage", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "blah blah maybe" }],
    });

    const r = await classifyBuyerLanguage(
      "We use a scanner today but exploring continuous compliance.",
    );
    expect(r.bucket).toBe("mixed");
  });

  it("falls back to 'mixed' when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const r = await classifyBuyerLanguage(
      "Looking at scanner tools but probably want continuous compliance.",
    );
    expect(r.bucket).toBe("mixed");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("classifyBuyerLanguage — evidence snippet quality", () => {
  it("returns a snippet centered on the first matched keyword", async () => {
    const longText =
      "We're a state university IT department evaluating tools after the DOJ Title II compliance deadline announcement. ".repeat(
        4,
      ) +
      "Specifically we need continuous monitoring across 47 properties.";
    const r = await classifyBuyerLanguage(longText);
    expect(r.bucket).toBe("infrastructure");
    expect(r.evidence.length).toBeLessThanOrEqual(220);
    expect(r.evidence.toLowerCase()).toContain("doj title ii");
  });

  it("returns first-200-chars when no keyword found", async () => {
    const text = "a".repeat(300);
    const r = await classifyBuyerLanguage(text);
    expect(r.bucket).toBe("unclear");
    expect(r.evidence.length).toBeLessThanOrEqual(200);
  });
});
