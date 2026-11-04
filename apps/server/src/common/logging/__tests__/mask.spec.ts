import { describe, expect, it } from "vitest";
import { maskEmail, maskToken, redact, redactLogEntry } from "../mask";

describe("mask", () => {
  it("masks email local parts but keeps the domain", () => {
    expect(maskEmail("owner@shop.test")).toBe("o***@shop.test");
    expect(maskEmail("login failed for a.b+c@x.co today")).toBe("login failed for a***@x.co today");
  });

  it("shortens tokens to a correlatable prefix", () => {
    expect(maskToken("a".repeat(64))).toBe("aaaa…(64)");
    expect(maskToken("short")).toBe("[REDACTED]");
  });

  it("redacts sensitive keys at any depth, whatever their casing", () => {
    expect(
      redact({
        body: { email: "owner@shop.test", password: "hunter2", refresh_token: "t" },
        headers: { Authorization: "Bearer x", "x-api-key": "k" },
        list: [{ idToken: "jwt" }],
      }),
    ).toEqual({
      body: { email: "o***@shop.test", password: "[REDACTED]", refresh_token: "[REDACTED]" },
      headers: { Authorization: "[REDACTED]", "x-api-key": "[REDACTED]" },
      list: [{ idToken: "[REDACTED]" }],
    });
  });

  it("survives cycles", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(redact(a)).toEqual({ name: "a", self: "[Circular]" });
  });

  it("does not treat error codes as secrets", () => {
    expect(redact({ code: "AUTHENTICATION_ERROR" })).toEqual({ code: "AUTHENTICATION_ERROR" });
  });

  it("redacts a log entry in place and leaves symbol keys alone", () => {
    const LEVEL = Symbol.for("level");
    const info: Record<string | symbol, unknown> = {
      message: "login for owner@shop.test",
      refreshToken: "abc",
      [LEVEL]: "info",
    };
    const result = redactLogEntry(info as Record<string, unknown>);
    expect(result).toBe(info);
    expect(info.message).toBe("login for o***@shop.test");
    expect(info.refreshToken).toBe("[REDACTED]");
    expect(info[LEVEL]).toBe("info");
  });
});
