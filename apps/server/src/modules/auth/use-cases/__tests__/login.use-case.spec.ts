import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError, ERROR_REASONS } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { LoginUseCase } from "../login.use-case";

describe("LoginUseCase", () => {
  let userRepository: { findByEmail: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let passwordHasher: {
    compare: ReturnType<typeof vi.fn>;
    compareDummy: ReturnType<typeof vi.fn>;
  };
  let tokenService: {
    generateAccessToken: ReturnType<typeof vi.fn>;
    issueSession: ReturnType<typeof vi.fn>;
  };
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepository = { findByEmail: vi.fn(), update: vi.fn().mockResolvedValue(buildUser()) };
    passwordHasher = { compare: vi.fn(), compareDummy: vi.fn().mockResolvedValue(false) };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue("access.jwt"),
      issueSession: vi.fn().mockResolvedValue({ sessionId: "sess-1", refreshToken: "refresh-raw" }),
    };
    useCase = new LoginUseCase(userRepository as any, passwordHasher as any, tokenService as any);
  });

  it("throws AuthenticationError when no user matches the email", async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute({ email: "ghost@shop.test", password: "x" })).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("still runs a (dummy) bcrypt compare for an unknown email, so timing matches", async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await useCase.execute({ email: "ghost@shop.test", password: "x" }).catch(() => {});
    expect(passwordHasher.compareDummy).toHaveBeenCalledWith("x");
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  it("looks the user up by normalised email", async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await useCase.execute({ email: "  Owner@Shop.TEST ", password: "x" }).catch(() => {});
    expect(userRepository.findByEmail).toHaveBeenCalledWith("owner@shop.test");
  });

  it("reports a deactivated account only after the password is proven correct", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ isActive: false }));
    passwordHasher.compare.mockResolvedValue(true);
    const error = await useCase.execute({ email: "a@b.com", password: "right" }).catch((e) => e);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.reason).toBe(ERROR_REASONS.AUTH_ACCOUNT_DISABLED);
  });

  it("gives a deactivated account with a wrong password the generic credentials error", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ isActive: false }));
    passwordHasher.compare.mockResolvedValue(false);
    const error = await useCase.execute({ email: "a@b.com", password: "wrong" }).catch((e) => e);
    expect(error.reason).toBe(ERROR_REASONS.AUTH_INVALID_CREDENTIALS);
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
    expect((unknownEmailError as AuthenticationError).reason).toBe(
      (wrongPasswordError as AuthenticationError).reason,
    );
  });

  it("returns user summary + access and refresh tokens on success", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({ email: "staff@shop.test", password: "correct" });

    expect(result.accessToken).toBe("access.jwt");
    expect(result.refreshToken).toBe("refresh-raw");
    expect(result.sessionId).toBe("sess-1");
    expect(result.user.email).toBe("staff@shop.test");
    expect(result.user.username).toBeNull();
  });

  it("generates the access token with the current tokenVersion from the DB row", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ tokenVersion: 3 }));
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: "staff@shop.test", password: "correct" });

    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenVersion: 3, sid: "sess-1" }),
    );
  });

  it("starts a session carrying the device name and client metadata", async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ id: "user-9" }));
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute(
      { email: "staff@shop.test", password: "correct", deviceName: "Work phone" },
      { ipAddress: "1.2.3.4", userAgent: "ua" },
    );

    expect(tokenService.issueSession).toHaveBeenCalledWith("user-9", {
      ipAddress: "1.2.3.4",
      userAgent: "ua",
      deviceName: "Work phone",
    });
  });

  it("persists lastLoginAt on successful login", async () => {
    const user = buildUser();
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(true);

    await useCase.execute({ email: "staff@shop.test", password: "correct" });

    expect(userRepository.update).toHaveBeenCalledWith(user.id, { lastLoginAt: expect.any(Date) });
  });
});
