import { test, expect } from "@playwright/test";
import {
  buildSlackPayload,
  buildDiscordPayload,
  buildTeamsPayload,
  type NotificationPayload,
} from "@/lib/notifications/webhook-router";
import { extractAuditContext } from "@/lib/audit/log";

/**
 * Pure-function tests for the cross-app shared audit + notification infra
 * adopted from app-09-saas-boilerplate per docs/cross-app-infra-adoption.md.
 * The audit_events table itself is verified by `npx tsc` + the migration
 * application (run via Supabase Management API, see session recovery doc).
 */

test.describe("Notification adapters", () => {
  const payload: NotificationPayload = {
    title: "Test alert",
    body: "Something happened",
    level: "warning",
    fields: [
      { label: "App", value: "AccessiScan" },
      { label: "Severity", value: "high" },
    ],
    cta: { label: "Open dashboard", url: "https://example.com/d" },
  };

  test("Slack payload has color + header + section + button", () => {
    const out = buildSlackPayload(payload) as { attachments: Array<{ color: string; blocks: Array<{ type: string }> }> };
    expect(out.attachments[0].color).toBe("#f59e0b");
    const types = out.attachments[0].blocks.map((b) => b.type);
    expect(types).toContain("header");
    expect(types).toContain("section");
    expect(types).toContain("actions");
  });

  test("Slack payload truncates title to 150 chars", () => {
    const long = { ...payload, title: "a".repeat(300) };
    const out = buildSlackPayload(long) as { attachments: Array<{ blocks: Array<any> }> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const header = out.attachments[0].blocks[0];
    expect(header.text.text.length).toBeLessThanOrEqual(150);
  });

  test("Discord payload has correct color int + embeds", () => {
    const out = buildDiscordPayload(payload) as { embeds: Array<{ color: number; fields: unknown[] }> };
    expect(out.embeds[0].color).toBe(0xf59e0b);
    expect(out.embeds[0].fields).toHaveLength(2);
  });

  test("Teams payload uses MessageCard schema with hex theme color", () => {
    const out = buildTeamsPayload(payload) as { "@type": string; themeColor: string };
    expect(out["@type"]).toBe("MessageCard");
    expect(out.themeColor).toBe("f59e0b");
  });

  test("info level maps to blue across adapters", () => {
    const info = { ...payload, level: "info" as const };
    const slack = buildSlackPayload(info) as { attachments: Array<{ color: string }> };
    const discord = buildDiscordPayload(info) as { embeds: Array<{ color: number }> };
    expect(slack.attachments[0].color).toBe("#3b82f6");
    expect(discord.embeds[0].color).toBe(0x3b82f6);
  });
});

test.describe("extractAuditContext", () => {
  test("reads x-forwarded-for first", () => {
    const h = new Headers();
    h.set("x-forwarded-for", "1.2.3.4, 5.6.7.8");
    h.set("x-real-ip", "9.9.9.9");
    h.set("user-agent", "TestAgent/1.0");
    expect(extractAuditContext(h)).toEqual({ ipAddress: "1.2.3.4", userAgent: "TestAgent/1.0" });
  });

  test("falls back to x-real-ip when forwarded missing", () => {
    const h = new Headers();
    h.set("x-real-ip", "9.9.9.9");
    expect(extractAuditContext(h).ipAddress).toBe("9.9.9.9");
  });

  test("returns undefined when headers missing", () => {
    expect(extractAuditContext(new Headers())).toEqual({
      ipAddress: undefined,
      userAgent: undefined,
    });
  });
});
