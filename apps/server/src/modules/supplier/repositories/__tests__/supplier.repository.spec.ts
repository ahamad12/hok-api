// modules/supplier/repositories/__tests__/supplier.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { SupplierRepository } from "../supplier.repository";

describe("SupplierRepository", () => {
  let prisma: any;
  let repo: SupplierRepository;

  beforeEach(() => {
    prisma = { supplier: { findUnique: vi.fn() } };
    repo = new SupplierRepository(prisma);
  });

  it("findById delegates to prisma.supplier.findUnique", async () => {
    const supplier = buildSupplier();
    prisma.supplier.findUnique.mockResolvedValue(supplier);
    await expect(repo.findById("supplier-1")).resolves.toEqual(supplier);
    expect(prisma.supplier.findUnique).toHaveBeenCalledWith({ where: { id: "supplier-1" } });
  });

  it("returns null when no supplier matches", async () => {
    prisma.supplier.findUnique.mockResolvedValue(null);
    await expect(repo.findById("missing")).resolves.toBeNull();
  });
});
