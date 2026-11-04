import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError } from "../../../../common/errors";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
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

  it("findByEmail normalises the email before looking it up", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await repo.findByEmail("  Staff@Shop.TEST ");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "staff@shop.test" } });
  });

  it("create stores the email normalised", async () => {
    prisma.user.create.mockResolvedValue(buildUser());
    await repo.create({ email: " New@Shop.test", passwordHash: "h", displayName: "N" } as any);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "new@shop.test" }),
    });
  });

  it("update delegates to prisma.user.update scoped by id", async () => {
    prisma.user.update.mockResolvedValue(buildUser());
    await repo.update("user-1", { displayName: "Changed" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "Changed" },
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

  describe("unique-violation translation", () => {
    it("create translates a P2002 on email into a ConflictError", async () => {
      prisma.user.create.mockRejectedValue(buildUniqueViolationError(["email"]));
      await expect(
        repo.create({ email: "taken@shop.test", passwordHash: "h", displayName: "X" } as any),
      ).rejects.toThrow(new ConflictError("A user with this email already exists"));
    });

    it("create translates a P2002 on username into a username ConflictError", async () => {
      prisma.user.create.mockRejectedValue(buildUniqueViolationError(["username"]));
      await expect(
        repo.create({ email: "new@shop.test", username: "taken", passwordHash: "h" } as any),
      ).rejects.toThrow(new ConflictError("A user with this username already exists"));
    });

    it("update translates a P2002 on username into a ConflictError", async () => {
      prisma.user.update.mockRejectedValue(buildUniqueViolationError(["username"]));
      await expect(repo.update("user-1", { username: "taken" } as any)).rejects.toThrow(
        new ConflictError("A user with this username already exists"),
      );
    });

    it("update translates a P2002 on email into an email ConflictError", async () => {
      prisma.user.update.mockRejectedValue(buildUniqueViolationError(["email"]));
      await expect(repo.update("user-1", { email: "taken@shop.test" } as any)).rejects.toThrow(
        new ConflictError("A user with this email already exists"),
      );
    });

    it("rethrows non-P2002 errors from create", async () => {
      const error = new Error("database down");
      prisma.user.create.mockRejectedValue(error);
      await expect(repo.create({ email: "x@shop.test", passwordHash: "h" } as any)).rejects.toThrow(
        error,
      );
    });
  });
});
