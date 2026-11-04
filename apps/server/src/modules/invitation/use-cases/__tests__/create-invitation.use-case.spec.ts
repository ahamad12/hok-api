import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "../../../../common/crypto/hash-token";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../../common/errors";
import { buildRequestUser, FOREIGN_SHOP_ID } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { UserRole } from "../../../../test/prisma-client-mock";
import { CreateInvitationUseCase } from "../create-invitation.use-case";

describe("CreateInvitationUseCase", () => {
  let invitationRepo: { createReplacingPending: ReturnType<typeof vi.fn> };
  let userRepo: { findByEmail: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let shopRepo: { findById: ReturnType<typeof vi.fn> };
  let mailer: { send: ReturnType<typeof vi.fn> };
  let useCase: CreateInvitationUseCase;

  const owner = buildRequestUser({ userId: "owner-1", role: UserRole.OWNER, shopId: null });
  const manager = buildRequestUser({ userId: "mgr-1", role: UserRole.MANAGER, shopId: null });

  beforeEach(() => {
    invitationRepo = {
      createReplacingPending: vi.fn(async (data) => ({
        id: "inv-1",
        ...data,
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date(),
      })),
    };
    userRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(buildUser({ displayName: "Ana Owner" })),
    };
    shopRepo = { findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })) };
    mailer = { send: vi.fn().mockResolvedValue(undefined) };
    useCase = new CreateInvitationUseCase(
      invitationRepo as any,
      userRepo as any,
      shopRepo as any,
      mailer as any,
    );
  });

  it("creates a pending invitation in the requester's tenant, storing only the token hash", async () => {
    const result = await useCase.execute(owner, {
      email: " New@Staff.test ",
      role: "STAFF",
      shopId: "shop-1",
    });

    const stored = invitationRepo.createReplacingPending.mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      tenantId: "owner-1",
      email: "new@staff.test",
      role: UserRole.STAFF,
      shopId: "shop-1",
      isSupervisor: false,
      invitedById: "owner-1",
    });
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result).toMatchObject({ id: "inv-1", status: "PENDING" });
    expect(result).not.toHaveProperty("tokenHash");
  });

  it("emails a link whose token matches the stored hash", async () => {
    await useCase.execute(owner, { email: "new@staff.test", role: "STAFF" });
    const [kind, to, , body] = mailer.send.mock.calls[0] ?? [];
    expect(kind).toBe("invitation");
    expect(to).toBe("new@staff.test");
    const token = /token=([0-9a-f]{64})/.exec(body)?.[1];
    expect(token).toBeDefined();
    expect(hashToken(token as string)).toBe(
      invitationRepo.createReplacingPending.mock.calls[0]?.[0].tokenHash,
    );
  });

  it("lets an OWNER invite a MANAGER", async () => {
    await expect(
      useCase.execute(owner, { email: "m@x.test", role: "MANAGER" }),
    ).resolves.toBeDefined();
  });

  it("does not let a MANAGER invite another MANAGER", async () => {
    await expect(useCase.execute(manager, { email: "m@x.test", role: "MANAGER" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("lets a MANAGER invite STAFF", async () => {
    await expect(
      useCase.execute(manager, { email: "s@x.test", role: "STAFF", shopId: "shop-1" }),
    ).resolves.toBeDefined();
  });

  it("refuses STAFF requesters", async () => {
    await expect(
      useCase.execute(buildRequestUser(), { email: "s@x.test", role: "STAFF" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("refuses a shop outside the requester's business", async () => {
    await expect(
      useCase.execute(owner, { email: "s@x.test", role: "STAFF", shopId: FOREIGN_SHOP_ID }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("refuses an inactive or missing shop", async () => {
    shopRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute(owner, { email: "s@x.test", role: "STAFF", shopId: "shop-1" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("enforces role invariants (supervisor needs a shop)", async () => {
    await expect(
      useCase.execute(owner, { email: "s@x.test", role: "STAFF", isSupervisor: true }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("refuses an email that already has an account", async () => {
    userRepo.findByEmail.mockResolvedValue(buildUser());
    await expect(useCase.execute(owner, { email: "taken@x.test", role: "STAFF" })).rejects.toThrow(
      ConflictError,
    );
    expect(invitationRepo.createReplacingPending).not.toHaveBeenCalled();
  });

  it("refuses a requester without a tenant", async () => {
    await expect(
      useCase.execute({ ...owner, tenantId: null }, { email: "s@x.test", role: "STAFF" }),
    ).rejects.toThrow(AuthorizationError);
  });
});
