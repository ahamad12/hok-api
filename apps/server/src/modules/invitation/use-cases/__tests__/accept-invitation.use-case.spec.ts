import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "../../../../common/crypto/hash-token";
import { BusinessRuleError, ConflictError, ERROR_REASONS } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { UserRole } from "../../../../test/prisma-client-mock";
import { AcceptInvitationUseCase } from "../accept-invitation.use-case";

const FUTURE = new Date(Date.now() + 86_400_000);

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    tenantId: "owner-1",
    email: "new@staff.test",
    role: UserRole.STAFF,
    shopId: "shop-1",
    isSupervisor: false,
    tokenHash: hashToken("raw-token"),
    invitedById: "owner-1",
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("AcceptInvitationUseCase", () => {
  let invitationRepo: {
    findByTokenHash: ReturnType<typeof vi.fn>;
    acceptAndCreateUser: ReturnType<typeof vi.fn>;
  };
  let userRepo: { findByEmail: ReturnType<typeof vi.fn> };
  let passwordHasher: { hash: ReturnType<typeof vi.fn> };
  let tokenService: {
    issueSession: ReturnType<typeof vi.fn>;
    generateAccessToken: ReturnType<typeof vi.fn>;
  };
  let useCase: AcceptInvitationUseCase;

  const input = { token: "raw-token", password: "Str0ng!Passw0rd", displayName: "New Staff" };

  beforeEach(() => {
    invitationRepo = {
      findByTokenHash: vi.fn().mockResolvedValue(invitation()),
      acceptAndCreateUser: vi
        .fn()
        .mockResolvedValue(
          buildUser({ id: "staff-9", email: "new@staff.test", ownerId: "owner-1" }),
        ),
    };
    userRepo = { findByEmail: vi.fn().mockResolvedValue(null) };
    passwordHasher = { hash: vi.fn().mockResolvedValue("hashed") };
    tokenService = {
      issueSession: vi.fn().mockResolvedValue({ sessionId: "sess-1", refreshToken: "refresh-raw" }),
      generateAccessToken: vi.fn().mockReturnValue("access.jwt"),
    };
    useCase = new AcceptInvitationUseCase(
      invitationRepo as any,
      userRepo as any,
      passwordHasher as any,
      tokenService as any,
    );
  });

  it("looks the invitation up by token hash, never the raw token", async () => {
    await useCase.execute(input);
    expect(invitationRepo.findByTokenHash).toHaveBeenCalledWith(hashToken("raw-token"));
  });

  it("creates the user inside the inviter's business with the invited role and shop", async () => {
    await useCase.execute(input);
    expect(invitationRepo.acceptAndCreateUser).toHaveBeenCalledWith(
      "inv-1",
      expect.any(Date),
      expect.objectContaining({
        email: "new@staff.test",
        passwordHash: "hashed",
        displayName: "New Staff",
        role: UserRole.STAFF,
        shopId: "shop-1",
        ownerId: "owner-1",
      }),
    );
  });

  it("signs the new user in with a tenant-scoped access token", async () => {
    const result = await useCase.execute(input, { ipAddress: "1.1.1.1", userAgent: "ua" });
    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "staff-9", sid: "sess-1", tid: "owner-1" }),
    );
    expect(result).toMatchObject({
      accessToken: "access.jwt",
      refreshToken: "refresh-raw",
      sessionId: "sess-1",
    });
  });

  it.each([
    ["unknown", null],
    ["accepted", invitation({ acceptedAt: new Date() })],
    ["revoked", invitation({ revokedAt: new Date() })],
    ["expired", invitation({ expiresAt: new Date(Date.now() - 1000) })],
  ])("rejects a %s invitation with the same INVITE_INVALID error", async (_label, found) => {
    invitationRepo.findByTokenHash.mockResolvedValue(found);
    const error = await useCase.execute(input).catch((e) => e);
    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(error.reason).toBe(ERROR_REASONS.INVITE_INVALID);
    expect(invitationRepo.acceptAndCreateUser).not.toHaveBeenCalled();
  });

  it("rejects when the guarded claim loses a race (another accept or a revoke)", async () => {
    invitationRepo.acceptAndCreateUser.mockResolvedValue(null);
    const error = await useCase.execute(input).catch((e) => e);
    expect(error.reason).toBe(ERROR_REASONS.INVITE_INVALID);
    expect(tokenService.issueSession).not.toHaveBeenCalled();
  });

  it("refuses when the email already has an account", async () => {
    userRepo.findByEmail.mockResolvedValue(buildUser());
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });
});
