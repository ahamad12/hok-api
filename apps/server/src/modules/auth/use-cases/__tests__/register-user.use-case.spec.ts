import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BusinessRuleError,
  ConflictError,
  ERROR_REASONS,
  FieldValidationError,
} from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { UserRole } from "../../../../test/prisma-client-mock";
import { RegisterUserUseCase } from "../register-user.use-case";

describe("RegisterUserUseCase (public sign-up = new OWNER)", () => {
  let userRepository: { create: ReturnType<typeof vi.fn> };
  let passwordHasher: { hash: ReturnType<typeof vi.fn> };
  let tokenService: {
    issueSession: ReturnType<typeof vi.fn>;
    generateAccessToken: ReturnType<typeof vi.fn>;
  };
  let useCase: RegisterUserUseCase;

  const validInput = {
    email: "owner@shop.test",
    password: "Str0ng!Passw0rd",
    displayName: "New Owner",
  };

  beforeEach(() => {
    userRepository = {
      create: vi.fn().mockResolvedValue(
        buildUser({
          id: "owner-9",
          email: "owner@shop.test",
          role: UserRole.OWNER,
          shopId: null,
        }),
      ),
    };
    passwordHasher = { hash: vi.fn().mockResolvedValue("hashed") };
    tokenService = {
      issueSession: vi.fn().mockResolvedValue({ sessionId: "sess-1", refreshToken: "refresh-raw" }),
      generateAccessToken: vi.fn().mockReturnValue("access.jwt"),
    };
    useCase = new RegisterUserUseCase(
      userRepository as any,
      passwordHasher as any,
      tokenService as any,
    );
  });

  it("always creates an OWNER with no shop and no tenant owner", async () => {
    await useCase.execute(validInput);
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@shop.test",
        passwordHash: "hashed",
        role: UserRole.OWNER,
        isSupervisor: false,
      }),
    );
    // Left unset (DB default NULL) rather than passed as null.
    const data = userRepository.create.mock.calls[0]?.[0];
    expect(data.shopId ?? null).toBeNull();
    expect(data.ownerId ?? null).toBeNull();
  });

  it("accepts an explicit role OWNER (what current clients send)", async () => {
    await expect(useCase.execute({ ...validInput, role: UserRole.OWNER })).resolves.toBeDefined();
  });

  it.each([
    UserRole.MANAGER,
    UserRole.STAFF,
  ])("refuses role %s and points to invitations, without creating anything", async (role) => {
    const error = await useCase.execute({ ...validInput, role }).catch((e) => e);
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error.violations[0]).toMatchObject({ field: "body.role" });
    expect(error.reason).toBe(ERROR_REASONS.INVITE_INVALID);
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it("refuses a shopId (owners are not assigned to shops)", async () => {
    await expect(useCase.execute({ ...validInput, shopId: "shop-1" })).rejects.toThrow(
      BusinessRuleError,
    );
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it("signs the new owner in: session with device metadata + access token bound to it", async () => {
    const result = await useCase.execute(
      { ...validInput, deviceName: "Owner phone" },
      { ipAddress: "1.2.3.4", userAgent: "ua" },
    );

    expect(tokenService.issueSession).toHaveBeenCalledWith("owner-9", {
      ipAddress: "1.2.3.4",
      userAgent: "ua",
      deviceName: "Owner phone",
    });
    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "owner-9", sid: "sess-1", tid: "owner-9" }),
    );
    expect(result).toMatchObject({
      accessToken: "access.jwt",
      refreshToken: "refresh-raw",
      sessionId: "sess-1",
      user: { id: "owner-9", role: UserRole.OWNER, shopId: null },
    });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("propagates a duplicate-email ConflictError from the repository", async () => {
    userRepository.create.mockRejectedValue(
      new ConflictError("A user with this email already exists"),
    );
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError);
    expect(tokenService.issueSession).not.toHaveBeenCalled();
  });
});
