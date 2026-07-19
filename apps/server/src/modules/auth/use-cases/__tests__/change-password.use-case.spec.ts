import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { ChangePasswordUseCase } from "../change-password.use-case";

describe("ChangePasswordUseCase", () => {
  let userRepository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let passwordHasher: { compare: ReturnType<typeof vi.fn>; hash: ReturnType<typeof vi.fn> };
  let tokenService: { revokeAllUserTokens: ReturnType<typeof vi.fn> };
  let tokenVersionService: { invalidateSessions: ReturnType<typeof vi.fn> };
  let useCase: ChangePasswordUseCase;

  const input = { userId: "user-1", currentPassword: "OldPass1!", newPassword: "NewPass1!" };

  beforeEach(() => {
    userRepository = { findById: vi.fn(), update: vi.fn().mockResolvedValue(buildUser()) };
    passwordHasher = { compare: vi.fn(), hash: vi.fn().mockResolvedValue("new-hash") };
    tokenService = { revokeAllUserTokens: vi.fn().mockResolvedValue(2) };
    tokenVersionService = { invalidateSessions: vi.fn().mockResolvedValue(1) };
    useCase = new ChangePasswordUseCase(
      userRepository as any,
      passwordHasher as any,
      tokenService as any,
      tokenVersionService as any,
    );

    userRepository.findById.mockResolvedValue(buildUser());
  });

  it("throws NotFoundError when the user does not exist", async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthenticationError when the current password is wrong", async () => {
    passwordHasher.compare.mockResolvedValueOnce(false);
    await expect(useCase.execute(input)).rejects.toThrow(AuthenticationError);
  });

  it("throws BusinessRuleError when the new password matches the current one", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("hashes the new password and persists it", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await useCase.execute(input);
    expect(passwordHasher.hash).toHaveBeenCalledWith(input.newPassword);
    expect(userRepository.update).toHaveBeenCalledWith("user-1", { passwordHash: "new-hash" });
  });

  it("invalidates sessions via TokenVersionService (DB + Redis together), not a direct repo call", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await useCase.execute(input);
    expect(tokenVersionService.invalidateSessions).toHaveBeenCalledWith("user-1");
  });

  it("revokes all existing refresh tokens", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await useCase.execute(input);
    expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith("user-1");
  });

  it("returns a message and the number of sessions revoked", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    tokenService.revokeAllUserTokens.mockResolvedValue(4);
    const result = await useCase.execute(input);
    expect(result.sessionsRevoked).toBe(4);
    expect(result.message).toMatch(/logged out from all devices/i);
  });
});
