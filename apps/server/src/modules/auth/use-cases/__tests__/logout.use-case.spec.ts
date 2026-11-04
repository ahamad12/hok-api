import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutUseCase } from "../logout.use-case";

describe("LogoutUseCase", () => {
  let tokenService: { revokeSessionByToken: ReturnType<typeof vi.fn> };
  let useCase: LogoutUseCase;

  beforeEach(() => {
    tokenService = { revokeSessionByToken: vi.fn().mockResolvedValue(undefined) };
    useCase = new LogoutUseCase(tokenService as any);
  });

  it("ends the session the refresh token belongs to", async () => {
    await useCase.execute({ refreshToken: "raw-token" });
    expect(tokenService.revokeSessionByToken).toHaveBeenCalledWith("raw-token");
  });

  it("returns a success message, also for unknown tokens (idempotent)", async () => {
    await expect(useCase.execute({ refreshToken: "already-gone" })).resolves.toEqual({
      message: "Logged out successfully",
    });
  });
});
