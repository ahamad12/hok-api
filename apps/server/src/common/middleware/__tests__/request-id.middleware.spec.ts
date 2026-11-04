import { describe, expect, it, vi } from "vitest";
import { requestIdMiddleware } from "../request-id.middleware";

function run(header?: string) {
  const req: any = { headers: header === undefined ? {} : { "x-request-id": header } };
  const res: any = { setHeader: vi.fn() };
  const next = vi.fn();
  requestIdMiddleware(req, res, next);
  return { req, res, next };
}

describe("requestIdMiddleware", () => {
  it("keeps a safe caller-supplied id and echoes it", () => {
    const { req, res, next } = run("abc-123");
    expect(req.requestId).toBe("abc-123");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "abc-123");
    expect(next).toHaveBeenCalled();
  });

  it("generates an id when none is supplied", () => {
    const { req } = run();
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("replaces an unsafe id instead of trusting it", () => {
    const { req } = run("evil\nINFO forged line");
    expect(req.requestId).not.toContain("\n");
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
