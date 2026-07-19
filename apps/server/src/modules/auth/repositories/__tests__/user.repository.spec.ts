import { beforeEach, describe, expect, it } from "vitest";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import {
  createPrismaServiceMock,
  type PrismaServiceMock,
} from "../../../../test/mocks/prisma.service.mock";
import { UserRepository } from "../user.repository";

describe("UserRepository", () => {
  let prisma: PrismaServiceMock;
  let repo: UserRepository;

  beforeEach(() => {
    prisma = createPrismaServiceMock();
    repo = new UserRepository(prisma as any);
  });

  it("findById delegates to prisma.user.findUnique by id", async () => {
    const user = buildUser();
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(repo.findById("user-1")).resolves.toEqual(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("findById returns null when no user matches", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(repo.findById("missing")).resolves.toBeNull();
  });

  it("findByEmail delegates to prisma.user.findUnique by email", async () => {
    const user = buildUser();
    prisma.user.findUnique.mockResolvedValue(user);
    await repo.findByEmail("staff@shop.test");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "staff@shop.test" } });
  });

  it("create delegates to prisma.user.create with the given data", async () => {
    const input = { email: "new@shop.test", passwordHash: "h", displayName: "New" } as any;
    prisma.user.create.mockResolvedValue(buildUser(input));
    await repo.create(input);
    expect(prisma.user.create).toHaveBeenCalledWith({ data: input });
  });

  it("update delegates to prisma.user.update scoped by id", async () => {
    prisma.user.update.mockResolvedValue(buildUser());
    await repo.update("user-1", { displayName: "Changed" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "Changed" },
    });
  });

  describe("existsByEmail", () => {
    it("returns true when count > 0", async () => {
      prisma.user.count.mockResolvedValue(1);
      await expect(repo.existsByEmail("a@b.com")).resolves.toBe(true);
    });

    it("returns false when count === 0", async () => {
      prisma.user.count.mockResolvedValue(0);
      await expect(repo.existsByEmail("a@b.com")).resolves.toBe(false);
    });
  });

  describe("existsByUsername", () => {
    it("returns true when count > 0", async () => {
      prisma.user.count.mockResolvedValue(2);
      await expect(repo.existsByUsername("someone")).resolves.toBe(true);
    });

    it("returns false when count === 0", async () => {
      prisma.user.count.mockResolvedValue(0);
      await expect(repo.existsByUsername("someone")).resolves.toBe(false);
    });
  });

  describe("incrementTokenVersion", () => {
    it("selects only tokenVersion and returns the updated value", async () => {
      prisma.user.update.mockResolvedValue({ tokenVersion: 4 });
      const result = await repo.incrementTokenVersion("user-1");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
      expect(result).toBe(4);
    });
  });
});
