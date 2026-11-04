import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError, ERROR_REASONS } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { RefreshTokenUseCase } from "../refresh-token.use-case";

describe("RefreshTokenUseCase", () => {
  let userRepository: { findById: ReturnType<typeof vi.fn> };
  let tokenService: {
    rotate: ReturnType<typeof vi.fn>;
    revokeSessionByToken: ReturnType<typeof vi.fn>;
    generateAccessToken: ReturnType<typeof vi.fn>;
  };
  let useCase: RefreshTokenUseCase;

  const rotated = { userId: "user-1", sessionId: "sess-1", refreshToken: "new-refresh-raw" };

  beforeEach(() => {
    userRepository = { findById: vi.fn() };
    tokenService = {
      rotate: vi.fn().mockResolvedValue(rotated),
      revokeSessionByToken: vi.fn().mockResolvedValue(undefined),
      generateAccessToken: vi.fn().mockReturnValue("new.access.jwt"),
    };
    useCase = new RefreshTokenUseCase(userRepository as any, tokenService as any);
  });

  it("propagates rotation failures (invalid, expired, reused) unchanged", async () => {
    const reused = new AuthenticationError("reused", ERROR_REASONS.AUTH_REFRESH_REUSED);
    tokenService.rotate.mockRejectedValue(reused);
    await expect(useCase.execute({ refreshToken: "bad" })).rejects.toBe(reused);
    expect(tokenService.generateAccessToken).not.toHaveBeenCalled();
  });

  it("passes client metadata to rotation", async () => {
    userRepository.findById.mockResolvedValue(buildUser());
    await useCase.execute({ refreshToken: "raw" }, { ipAddress: "1.2.3.4", userAgent: "ua" });
    expect(tokenService.rotate).toHaveBeenCalledWith("raw", {
      ipAddress: "1.2.3.4",
      userAgent: "ua",
    });
  });

  it("ends the new session and rejects if the user no longer exists", async () => {
    userRepository.findById.mockResolvedValue(null);
    const error = await useCase.execute({ refreshToken: "raw" }).catch((e) => e);
    expect(error.reason).toBe(ERROR_REASONS.AUTH_REFRESH_INVALID);
    expect(tokenService.revokeSessionByToken).toHaveBeenCalledWith("new-refresh-raw");
  });

  it("ends the new session and rejects if the user has been deactivated", async () => {
    userRepository.findById.mockResolvedValue(buildUser({ isActive: false }));
    const error = await useCase.execute({ refreshToken: "raw" }).catch((e) => e);
    expect(error.reason).toBe(ERROR_REASONS.AUTH_ACCOUNT_DISABLED);
    expect(tokenService.revokeSessionByToken).toHaveBeenCalledWith("new-refresh-raw");
  });

  it("returns the rotated refresh token, the session id and an access token bound to it", async () => {
    userRepository.findById.mockResolvedValue(buildUser({ id: "user-1", tokenVersion: 4 }));
    const result = await useCase.execute({ refreshToken: "raw" });
    expect(result).toEqual({
      accessToken: "new.access.jwt",
      refreshToken: "new-refresh-raw",
      sessionId: "sess-1",
    });
    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", tokenVersion: 4, sid: "sess-1" }),
    );
  });
});
