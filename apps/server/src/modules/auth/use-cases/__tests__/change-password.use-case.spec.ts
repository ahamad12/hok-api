import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BusinessRuleError,
  ERROR_REASONS,
  FieldValidationError,
  NotFoundError,
} from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { ChangePasswordUseCase } from "../change-password.use-case";

describe("ChangePasswordUseCase", () => {
  let userRepository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let passwordHasher: {
    compare: ReturnType<typeof vi.fn>;
    hash: ReturnType<typeof vi.fn>;
    checkStrength: ReturnType<typeof vi.fn>;
  };
  let tokenService: { revokeAllSessions: ReturnType<typeof vi.fn> };
  let tokenVersionService: { invalidateSessions: ReturnType<typeof vi.fn> };
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };
  let useCase: ChangePasswordUseCase;

  const input = { userId: "user-1", currentPassword: "OldPass1!", newPassword: "NewPass1!" };

  beforeEach(() => {
    userRepository = { findById: vi.fn(), update: vi.fn().mockResolvedValue(buildUser()) };
    passwordHasher = {
      compare: vi.fn(),
      hash: vi.fn().mockResolvedValue("new-hash"),
      checkStrength: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
    };
    tokenService = { revokeAllSessions: vi.fn().mockResolvedValue(2) };
    tokenVersionService = { invalidateSessions: vi.fn().mockResolvedValue(1) };
    eventEmitter = { emit: vi.fn() };
    useCase = new ChangePasswordUseCase(
      userRepository as any,
      passwordHasher as any,
      tokenService as any,
      tokenVersionService as any,
      eventEmitter as any,
    );

    userRepository.findById.mockResolvedValue(buildUser());
  });

  it("throws NotFoundError when the user does not exist", async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("rejects a wrong current password as a 400 field violation, not a 401", async () => {
    passwordHasher.compare.mockResolvedValueOnce(false);
    const error = await useCase.execute(input).catch((e) => e);
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error.httpStatus).toBe(400);
    expect(error.reason).toBe(ERROR_REASONS.AUTH_INVALID_CREDENTIALS);
    expect(error.violations).toEqual([
      expect.objectContaining({ field: "body.currentPassword", code: "incorrect" }),
    ]);
  });

  it("throws BusinessRuleError when the new password matches the current one", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the new password is too weak", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true);
    passwordHasher.checkStrength.mockReturnValue({
      isValid: false,
      errors: ["Password must contain at least one number"],
    });
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
    expect(userRepository.update).not.toHaveBeenCalled();
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

  it("emits a user.password_changed domain event after invalidating sessions", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await useCase.execute(input);
    expect(eventEmitter.emit).toHaveBeenCalledWith("user.password_changed", { userId: "user-1" });
  });

  it("revokes all existing refresh tokens", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await useCase.execute(input);
    expect(tokenService.revokeAllSessions).toHaveBeenCalledWith("user-1", "PASSWORD_CHANGED");
  });

  it("returns a message and the number of sessions revoked", async () => {
    passwordHasher.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    tokenService.revokeAllSessions.mockResolvedValue(4);
    const result = await useCase.execute(input);
    expect(result.sessionsRevoked).toBe(4);
    expect(result.message).toMatch(/logged out from all devices/i);
  });
});
