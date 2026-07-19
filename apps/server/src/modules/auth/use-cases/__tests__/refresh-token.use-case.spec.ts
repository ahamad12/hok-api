import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { RefreshTokenUseCase } from "../refresh-token.use-case";

describe("RefreshTokenUseCase", () => {
  let userRepository: { findById: ReturnType<typeof vi.fn> };
  let tokenService: {
    verifyRefreshToken: ReturnType<typeof vi.fn>;
    revokeRefreshToken: ReturnType<typeof vi.fn>;
    generateAccessToken: ReturnType<typeof vi.fn>;
    generateRefreshToken: ReturnType<typeof vi.fn>;
  };
  let useCase: RefreshTokenUseCase;

  beforeEach(() => {
    userRepository = { findById: vi.fn() };
    tokenService = {
      verifyRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
      generateAccessToken: vi.fn().mockReturnValue("new.access.jwt"),
      generateRefreshToken: vi.fn().mockResolvedValue("new-refresh-raw"),
    };
    useCase = new RefreshTokenUseCase(userRepository as any, tokenService as any);
  });

  it("throws AuthenticationError when the refresh token itself is invalid/expired", async () => {
    tokenService.verifyRefreshToken.mockRejectedValue(
      new AuthenticationError("Invalid refresh token"),
    );
    await expect(useCase.execute({ refreshToken: "bad" })).rejects.toThrow(AuthenticationError);
  });

  it("throws AuthenticationError if the user behind a valid token no longer exists", async () => {
    tokenService.verifyRefreshToken.mockResolvedValue("user-1");
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ refreshToken: "raw" })).rejects.toThrow(AuthenticationError);
  });

  it("throws AuthenticationError if the user has since been deactivated", async () => {
    tokenService.verifyRefreshToken.mockResolvedValue("user-1");
    userRepository.findById.mockResolvedValue(buildUser({ isActive: false }));
    await expect(useCase.execute({ refreshToken: "raw" })).rejects.toThrow(AuthenticationError);
  });

  it("revokes the old refresh token BEFORE issuing the new one", async () => {
    tokenService.verifyRefreshToken.mockResolvedValue("user-1");
    userRepository.findById.mockResolvedValue(buildUser());

    const callOrder: string[] = [];
    tokenService.revokeRefreshToken.mockImplementation(async () => {
      callOrder.push("revoke");
    });
    tokenService.generateRefreshToken.mockImplementation(async () => {
      callOrder.push("generate");
      return "new-refresh-raw";
    });

    await useCase.execute({ refreshToken: "raw" });
    expect(callOrder).toEqual(["revoke", "generate"]);
  });

  it("returns a fresh access + refresh token pair on success", async () => {
    tokenService.verifyRefreshToken.mockResolvedValue("user-1");
    userRepository.findById.mockResolvedValue(buildUser());

    const result = await useCase.execute({ refreshToken: "raw" });
    expect(result).toEqual({ accessToken: "new.access.jwt", refreshToken: "new-refresh-raw" });
  });

  it("does not call generateRefreshToken if revoking the old token throws unexpectedly", async () => {
    tokenService.verifyRefreshToken.mockResolvedValue("user-1");
    userRepository.findById.mockResolvedValue(buildUser());
    tokenService.revokeRefreshToken.mockRejectedValue(new Error("unexpected"));

    await expect(useCase.execute({ refreshToken: "raw" })).rejects.toThrow("unexpected");
    expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
  });
});
