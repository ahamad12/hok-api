import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../common/errors";
import { FormRepository } from "../form.repository";

function setup() {
  const prisma = {
    form: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const repo = new FormRepository(prisma as any);
  return { repo, prisma };
}

describe("FormRepository", () => {
  it("findByIdOrThrow throws NotFoundError when the row does not exist", async () => {
    const { repo, prisma } = setup();
    prisma.form.findUnique.mockResolvedValue(null);
    await expect(repo.findByIdOrThrow("missing")).rejects.toThrow(NotFoundError);
  });

  it("findByIdOrThrow returns the row when it exists", async () => {
    const { repo, prisma } = setup();
    prisma.form.findUnique.mockResolvedValue({ id: "form-1" });
    await expect(repo.findByIdOrThrow("form-1")).resolves.toEqual({ id: "form-1" });
  });

  it("findAll omits isActive from the where clause when not provided", async () => {
    const { repo, prisma } = setup();
    prisma.form.findMany.mockResolvedValue([]);
    await repo.findAll({ shopId: "shop-1" });
    expect(prisma.form.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("findAll includes isActive in the where clause when provided", async () => {
    const { repo, prisma } = setup();
    prisma.form.findMany.mockResolvedValue([]);
    await repo.findAll({ shopId: "shop-1", isActive: false });
    expect(prisma.form.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1", isActive: false },
      orderBy: { createdAt: "desc" },
    });
  });

  it("create passes data straight through to prisma.form.create", async () => {
    const { repo, prisma } = setup();
    const input = { shopId: "shop-1", title: "T", schema: [], isActive: true };
    prisma.form.create.mockResolvedValue({ id: "form-1", ...input });
    await repo.create(input as any);
    expect(prisma.form.create).toHaveBeenCalledWith({ data: input });
  });
});
