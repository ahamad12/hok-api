// common/domain/__tests__/ticket-transitions.spec.ts
import { describe, expect, it } from "vitest";
import { allowedNextStates, isValidTransition } from "../ticket-transitions";

describe("ISSUE transitions", () => {
  it.each([
    ["OPEN", "IN_PROGRESS", true],
    ["OPEN", "CLOSED", true],
    ["OPEN", "RESOLVED", false],
    ["IN_PROGRESS", "RESOLVED", true],
    ["IN_PROGRESS", "OPEN", true],
    ["IN_PROGRESS", "CLOSED", false],
    ["RESOLVED", "CLOSED", true],
    ["RESOLVED", "IN_PROGRESS", true],
    ["RESOLVED", "OPEN", false],
    ["CLOSED", "OPEN", true],
    ["CLOSED", "IN_PROGRESS", false],
    ["CLOSED", "RESOLVED", false],
  ])("ISSUE: %s -> %s is valid: %s", (from, to, expected) => {
    expect(isValidTransition("ISSUE", from as any, to as any)).toBe(expected);
  });
});

describe("INSTRUCTION / ANNOUNCEMENT (broadcast) transitions", () => {
  it.each([
    ["OPEN", "CLOSED", true],
    ["OPEN", "IN_PROGRESS", false],
    ["OPEN", "RESOLVED", false],
    ["CLOSED", "OPEN", true],
    ["CLOSED", "IN_PROGRESS", false],
    ["IN_PROGRESS", "OPEN", false],
    ["RESOLVED", "OPEN", false],
  ])("INSTRUCTION: %s -> %s is valid: %s", (from, to, expected) => {
    expect(isValidTransition("INSTRUCTION", from as any, to as any)).toBe(expected);
  });

  it("ANNOUNCEMENT follows the same matrix as INSTRUCTION", () => {
    expect(isValidTransition("ANNOUNCEMENT", "OPEN", "CLOSED")).toBe(true);
    expect(isValidTransition("ANNOUNCEMENT", "OPEN", "IN_PROGRESS")).toBe(false);
  });
});

describe("allowedNextStates", () => {
  it("returns the ISSUE matrix's next states for a given status", () => {
    expect(allowedNextStates("ISSUE", "OPEN")).toEqual(["IN_PROGRESS", "CLOSED"]);
  });

  it("returns an empty array for a broadcast's dead-end states", () => {
    expect(allowedNextStates("INSTRUCTION", "IN_PROGRESS")).toEqual([]);
    expect(allowedNextStates("INSTRUCTION", "RESOLVED")).toEqual([]);
  });
});
