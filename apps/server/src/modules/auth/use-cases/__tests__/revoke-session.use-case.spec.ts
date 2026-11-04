import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../common/errors";
import { RevokeSessionUseCase } from "../revoke-session.use-case";

describe("RevokeSessionUseCase", () => {
  it("revokes one of the caller's sessions", async () => {
    const tokenService = { revokeSessionById: vi.fn().mockResolvedValue(true) };
    const result = await new RevokeSessionUseCase(tokenService as any).execute("user-1", "sess-1");
    expect(tokenService.revokeSessionById).toHaveBeenCalledWith("user-1", "sess-1");
    expect(result).toEqual({ message: "Session ended" });
  });

  it("404s for a session that isn't the caller's or is already ended", async () => {
    const tokenService = { revokeSessionById: vi.fn().mockResolvedValue(false) };
    await expect(
      new RevokeSessionUseCase(tokenService as any).execute("user-1", "someone-elses"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
