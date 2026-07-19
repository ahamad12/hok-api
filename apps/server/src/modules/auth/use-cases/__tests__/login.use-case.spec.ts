import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { LoginUseCase } from "../login.use-case";

describe("LoginUseCase", () => {
  let userRepository: { findByEmail: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let passwordHasher: { compare: ReturnType<typeof vi.fn> };
  let tokenService: {
    generateAccessToken: ReturnType<typeof vi.fn>;
    generateRefreshToken: ReturnType<typeof vi.fn>;
  };
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepository = { findByEmail: vi.fn(), update: vi.fn().mockResolvedValue(buildUser()) };
    passwordHasher = { compare: vi.fn() };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue("access.jwt"),
      generateRefreshToken: vi.fn().mockResolvedValue("refresh-raw"),
    };
    useCase = new LoginUseCase(userRepository as any, passwordHasher as any, tokenService as any);
  });

  it("throws AuthenticationError when no user matches the email", async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute({ email: "ghost@shop.test", password: "x" })).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("throws AuthenticationError for a deactivated account, without attempting a password check", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ isActive: false }));
    await expect(useCase.execute({ email: "a@b.com", password: "x" })).rejects.toThrow(
      AuthenticationError,
    );
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  it("throws AuthenticationError for a wrong password", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(false);
    await expect(useCase.execute({ email: "a@b.com", password: "wrong" })).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("throws the same error message for unknown-email and wrong-password (no user enumeration)", async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    let unknownEmailError: Error | undefined;
    try {
      await useCase.execute({ email: "ghost@shop.test", password: "x" });
    } catch (e) {
      unknownEmailError = e as Error;
    }

    userRepository.findByEmail.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(false);
    let wrongPasswordError: Error | undefined;
    try {
      await useCase.execute({ email: "a@b.com", password: "wrong" });
    } catch (e) {
      wrongPasswordError = e as Error;
    }

    expect(unknownEmailError?.message).toBe(wrongPasswordError?.message);
  });

  it("returns user summary + access and refresh tokens on success", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({ email: "staff@shop.test", password: "correct" });

    expect(result.accessToken).toBe("access.jwt");
    expect(result.refreshToken).toBe("refresh-raw");
    expect(result.user.email).toBe("staff@shop.test");
  });

  it("generates the access token with the current tokenVersion from the DB row", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ tokenVersion: 3 }));
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: "staff@shop.test", password: "correct" });

    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenVersion: 3 }),
    );
  });

  it("persists lastLoginAt on successful login", async () => {
    const user = buildUser();
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: "staff@shop.test", password: "correct" });

    expect(userRepository.update).toHaveBeenCalledWith(user.id, { lastLoginAt: expect.any(Date) });
  });
});
