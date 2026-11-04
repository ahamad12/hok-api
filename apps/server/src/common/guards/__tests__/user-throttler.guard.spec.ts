import { Reflector } from "@nestjs/core";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailTracker, UserThrottlerGuard } from "../user-throttler.guard";

class Routes {
  plain() {}

  @Throttle({ "message-burst": { limit: 3, ttl: 1000 } })
  optedIn() {}
}

function contextFor(method: keyof Routes) {
  return {
    getHandler: () => Routes.prototype[method],
    getClass: () => Routes,
  } as any;
}

describe("UserThrottlerGuard", () => {
  let guard: UserThrottlerGuard;
  let parentHandle: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    guard = new UserThrottlerGuard({ throttlers: [] } as any, {} as any, new Reflector());
    // The base implementation would hit throttler storage; stub it.
    parentHandle = vi
      .spyOn(ThrottlerGuard.prototype as any, "handleRequest")
      .mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const call = (method: keyof Routes, name: string) =>
    (guard as any).handleRequest({ context: contextFor(method), throttler: { name } });

  it("always applies the default throttler", async () => {
    await call("plain", "default");
    expect(parentHandle).toHaveBeenCalledTimes(1);
  });

  it("skips a named throttler on a route that did not opt in", async () => {
    await expect(call("plain", "message-burst")).resolves.toBe(true);
    expect(parentHandle).not.toHaveBeenCalled();
  });

  it("applies a named throttler on a route that opted in via @Throttle", async () => {
    await call("optedIn", "message-burst");
    expect(parentHandle).toHaveBeenCalledTimes(1);
  });

  it("does not apply a different named throttler to an opted-in route", async () => {
    await call("optedIn", "auth");
    expect(parentHandle).not.toHaveBeenCalled();
  });
});

describe("emailTracker", () => {
  it("keys on the normalised email, not the raw value", () => {
    const a = emailTracker({ body: { email: " Owner@Shop.test " }, ip: "1.1.1.1" });
    const b = emailTracker({ body: { email: "owner@shop.test" }, ip: "2.2.2.2" });
    expect(a).toBe(b);
    expect(a).not.toContain("owner@shop.test");
  });

  it("falls back to IP when there is no email", () => {
    expect(emailTracker({ body: {}, ip: "1.1.1.1" })).toBe("ip:1.1.1.1");
  });
});
