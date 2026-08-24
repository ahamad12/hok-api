// modules/auth/repositories/__tests__/refresh-token.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNotFoundError } from "../../../../test/fixtures/prisma-error.fixture";
import { RefreshTokenRepository } from "../refresh-token.repository";

function buildPrismaMock() {
  const refreshToken = {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
  return { refreshToken };
}

describe("RefreshTokenRepository", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let repo: RefreshTokenRepository;

  const record = {
    id: "rt-1",
    userId: "user-1",
    token: "hashed-token",
    expiresAt: new Date("2026-08-27T00:00:00.000Z"),
  };

  beforeEach(() => {
    prisma = buildPrismaMock();
    repo = new RefreshTokenRepository(prisma as any);
  });

  it("create connects the token to the user by id and stores the hashed value", async () => {
    prisma.refreshToken.create.mockResolvedValue(record);
    await repo.create({ userId: "user-1", token: "hashed-token", expiresAt: record.expiresAt });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        user: { connect: { id: "user-1" } },
        token: "hashed-token",
        expiresAt: record.expiresAt,
      },
    });
  });

  it("findByToken delegates to prisma.refreshToken.findUnique by token", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(record);
    await expect(repo.findByToken("hashed-token")).resolves.toEqual(record);
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { token: "hashed-token" },
    });
  });

  it("findByToken returns null when no token matches", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(repo.findByToken("unknown")).resolves.toBeNull();
  });

  it("deleteById absorbs P2025 — deleting an already-gone token is idempotent", async () => {
    prisma.refreshToken.delete.mockRejectedValue(buildNotFoundError());
    await expect(repo.deleteById("rt-1")).resolves.toBeUndefined();
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: "rt-1" } });
  });

  it("deleteById rethrows failures that are not 'not found'", async () => {
    const failure = new Error("connection reset");
    prisma.refreshToken.delete.mockRejectedValue(failure);
    await expect(repo.deleteById("rt-1")).rejects.toThrow(failure);
  });

  it("deleteByToken absorbs P2025 — revoking an unknown token is not an error", async () => {
    prisma.refreshToken.delete.mockRejectedValue(buildNotFoundError());
    await expect(repo.deleteByToken("hashed-token")).resolves.toBeUndefined();
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { token: "hashed-token" } });
  });

  it("deleteByToken rethrows failures that are not 'not found'", async () => {
    const failure = new Error("connection reset");
    prisma.refreshToken.delete.mockRejectedValue(failure);
    await expect(repo.deleteByToken("hashed-token")).rejects.toThrow(failure);
  });

  it("deleteManyByUser delegates to deleteMany scoped by userId and returns the count", async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
    await expect(repo.deleteManyByUser("user-1")).resolves.toBe(3);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("deleteExpired deletes only tokens expiring strictly before the given time", async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });
    const now = new Date("2026-08-20T12:00:00.000Z");
    await expect(repo.deleteExpired(now)).resolves.toBe(2);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } },
    });
  });
});
