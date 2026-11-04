import { beforeEach, describe, expect, it, vi } from "vitest";
import { authLink } from "../../../../common/auth/auth-mailer.service";
import { BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { UserRole } from "../../../../test/prisma-client-mock";
import {
  GetInvitationsUseCase,
  ResendInvitationUseCase,
  RevokeInvitationUseCase,
} from "../manage-invitations.use-case";

const owner = buildRequestUser({ userId: "owner-1", role: UserRole.OWNER, shopId: null });

function inv(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    tenantId: "owner-1",
    email: "s@x.test",
    role: UserRole.STAFF,
    shopId: null,
    isSupervisor: false,
    tokenHash: "h",
    invitedById: "owner-1",
    expiresAt: new Date(Date.now() + 86_400_000),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("invitation management", () => {
  let repo: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    repo = {
      findById: vi.fn().mockResolvedValue(inv()),
      findAllForTenant: vi.fn().mockResolvedValue({ invitations: [inv()], total: 1 }),
      revokeIfPending: vi.fn().mockResolvedValue(1),
      rotateTokenIfPending: vi.fn().mockResolvedValue(1),
    };
  });

  it("lists only the requester's tenant", async () => {
    const result = await new GetInvitationsUseCase(repo as any).execute(owner, {
      limit: 50,
      offset: 0,
    });
    expect(repo.findAllForTenant).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "owner-1" }),
    );
    expect(result.invitations[0]).toMatchObject({ id: "inv-1", status: "PENDING" });
    expect(result.invitations[0]).not.toHaveProperty("tokenHash");
  });

  it("treats another tenant's invitation as not found (revoke)", async () => {
    repo.findById?.mockResolvedValue(inv({ tenantId: "another-owner" }));
    await expect(new RevokeInvitationUseCase(repo as any).execute(owner, "inv-1")).rejects.toThrow(
      NotFoundError,
    );
    expect(repo.revokeIfPending).not.toHaveBeenCalled();
  });

  it("revokes a pending invitation", async () => {
    repo.findById
      ?.mockResolvedValueOnce(inv())
      .mockResolvedValueOnce(inv({ revokedAt: new Date() }));
    const result = await new RevokeInvitationUseCase(repo as any).execute(owner, "inv-1");
    expect(result.status).toBe("REVOKED");
  });

  it("refuses to revoke an accepted invitation", async () => {
    repo.revokeIfPending?.mockResolvedValue(0);
    await expect(new RevokeInvitationUseCase(repo as any).execute(owner, "inv-1")).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("resend rotates the token (old link dies) and emails the new one", async () => {
    const createInvitation = { sendInvitationEmail: vi.fn().mockResolvedValue(undefined) };
    await new ResendInvitationUseCase(repo as any, createInvitation as any).execute(owner, "inv-1");
    expect(repo.rotateTokenIfPending).toHaveBeenCalledWith(
      "inv-1",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(Date),
    );
    expect(createInvitation.sendInvitationEmail).toHaveBeenCalledWith(
      "owner-1",
      "s@x.test",
      UserRole.STAFF,
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });
});

describe("authLink", () => {
  it("joins scheme-only bases without a slash and URL bases with one", () => {
    expect(authLink("invite", "t", "tapt://")).toBe("tapt://invite?token=t");
    expect(authLink("invite", "t", "https://app.tapt.test")).toBe(
      "https://app.tapt.test/invite?token=t",
    );
    expect(authLink("reset-password", "t", "https://app.tapt.test/")).toBe(
      "https://app.tapt.test/reset-password?token=t",
    );
  });
});
