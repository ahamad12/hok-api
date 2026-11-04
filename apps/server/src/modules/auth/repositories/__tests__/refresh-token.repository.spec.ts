// modules/auth/repositories/__tests__/refresh-token.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshTokenRepository } from "../refresh-token.repository";

function buildPrismaMock() {
  const refreshToken = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  // Interactive transactions run the callback against the same mock.
  const prisma = {
    refreshToken,
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return prisma;
}

const NOW = new Date("2026-11-04T10:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "rt-1",
    userId: "user-1",
    familyId: "fam-1",
    token: "hash-old",
    expiresAt: new Date("2026-11-11T10:00:00.000Z"),
    sessionStartedAt: new Date("2026-11-01T10:00:00.000Z"),
    createdAt: new Date("2026-11-03T10:00:00.000Z"),
    revokedAt: null,
    revokeReason: null,
    replacedById: null,
    deviceName: "Phone",
    userAgent: "ua-old",
    ipAddress: "1.1.1.1",
    ...overrides,
  };
}

describe("RefreshTokenRepository", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let repo: RefreshTokenRepository;

  beforeEach(() => {
    prisma = buildPrismaMock();
    repo = new RefreshTokenRepository(prisma as any);
  });

  it("create connects the user and stores family + device metadata", async () => {
    prisma.refreshToken.create.mockResolvedValue(row());
    await repo.create({
      userId: "user-1",
      familyId: "fam-1",
      token: "hash",
      expiresAt: NOW,
      sessionStartedAt: NOW,
      deviceName: "Phone",
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        user: { connect: { id: "user-1" } },
        familyId: "fam-1",
        token: "hash",
        expiresAt: NOW,
        sessionStartedAt: NOW,
        deviceName: "Phone",
        userAgent: null,
        ipAddress: null,
      },
    });
  });

  describe("rotate", () => {
    const buildNext = () => ({
      token: "hash-new",
      expiresAt: new Date("2026-11-11T10:00:00.000Z"),
      sessionStartedAt: new Date("2026-11-01T10:00:00.000Z"),
      userAgent: "ua-new",
      ipAddress: null,
    });

    it("claims the token with a guarded updateMany, then creates the child in the same family", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.findUnique.mockResolvedValue(row());
      prisma.refreshToken.create.mockResolvedValue(row({ id: "rt-2", token: "hash-new" }));

      const result = await repo.rotate("hash-old", NOW, buildNext);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: "hash-old", revokedAt: null, expiresAt: { gt: NOW } },
        data: { revokedAt: NOW, revokeReason: "ROTATED" },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          familyId: "fam-1",
          token: "hash-new",
          sessionStartedAt: new Date("2026-11-01T10:00:00.000Z"),
          deviceName: "Phone", // carried over from the parent
          userAgent: "ua-new", // refreshed from the request
          ipAddress: "1.1.1.1", // parent's, since the request gave none
        }),
      });
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { replacedById: "rt-2" },
      });
      expect(result.status).toBe("rotated");
    });

    it("reports reuse when the presented token was already rotated (the losing concurrent refresh or a replay)", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.refreshToken.findUnique.mockResolvedValue(
        row({ revokedAt: NOW, revokeReason: "ROTATED" }),
      );
      const result = await repo.rotate("hash-old", NOW, buildNext);
      expect(result.status).toBe("reused");
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("reports a token revoked by logout as revoked, not reuse", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.refreshToken.findUnique.mockResolvedValue(
        row({ revokedAt: NOW, revokeReason: "LOGOUT" }),
      );
      expect((await repo.rotate("hash-old", NOW, buildNext)).status).toBe("revoked");
    });

    it("reports an unrevoked but expired token as expired", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.refreshToken.findUnique.mockResolvedValue(row({ expiresAt: new Date("2026-01-01") }));
      expect((await repo.rotate("hash-old", NOW, buildNext)).status).toBe("expired");
    });

    it("reports an unknown token", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      expect((await repo.rotate("nope", NOW, buildNext)).status).toBe("unknown");
    });
  });

  it("revokeFamily revokes only live rows of that family", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await expect(repo.revokeFamily("fam-1", "REUSE_DETECTED", NOW)).resolves.toBe(1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: "fam-1", revokedAt: null },
      data: { revokedAt: NOW, revokeReason: "REUSE_DETECTED" },
    });
  });

  it("revokeUserFamily scopes by owner so other users' sessions can't be revoked", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await repo.revokeUserFamily("user-2", "fam-1", "SESSION_REVOKED", NOW);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-2", familyId: "fam-1", revokedAt: null },
      data: { revokedAt: NOW, revokeReason: "SESSION_REVOKED" },
    });
  });

  it("revokeAllForUser returns the number of live sessions ended", async () => {
    prisma.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });
    await expect(repo.revokeAllForUser("user-1", "LOGOUT_ALL", NOW)).resolves.toBe(2);
    expect(prisma.refreshToken.updateMany).toHaveBeenNthCalledWith(1, {
      where: { userId: "user-1", revokedAt: null, expiresAt: { gt: NOW } },
      data: { revokedAt: NOW, revokeReason: "LOGOUT_ALL" },
    });
  });

  it("findActiveForUser returns live, unexpired tokens newest first", async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);
    await repo.findActiveForUser("user-1", NOW);
    expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null, expiresAt: { gt: NOW } },
      orderBy: { createdAt: "desc" },
    });
  });

  it("deleteExpiredBefore removes rows expired before the cutoff", async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
    await expect(repo.deleteExpiredBefore(NOW)).resolves.toBe(3);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: NOW } },
    });
  });
});
