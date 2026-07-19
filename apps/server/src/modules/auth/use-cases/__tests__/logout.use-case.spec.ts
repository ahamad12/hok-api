import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutUseCase } from "../logout.use-case";

describe("LogoutUseCase", () => {
  let tokenService: { revokeRefreshToken: ReturnType<typeof vi.fn> };
  let useCase: LogoutUseCase;

  beforeEach(() => {
    tokenService = { revokeRefreshToken: vi.fn().mockResolvedValue(undefined) };
    useCase = new LogoutUseCase(tokenService as any);
  });

  it("revokes the given refresh token", async () => {
    await useCase.execute({ refreshToken: "raw-token" });
    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith("raw-token");
  });

  it("returns a success message", async () => {
    const result = await useCase.execute({ refreshToken: "raw-token" });
    expect(result).toEqual({ message: "Logged out successfully" });
  });

  it("does not throw for an already-revoked or unknown token (idempotent)", async () => {
    tokenService.revokeRefreshToken.mockResolvedValue(undefined);
    await expect(useCase.execute({ refreshToken: "already-gone" })).resolves.toEqual({
      message: "Logged out successfully",
    });
  });
});
