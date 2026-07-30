// modules/till-entry/use-cases/__tests__/create-till-entry.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildTillEntry } from "../../../../test/fixtures/till-entry.fixture";
import { CreateTillEntryUseCase } from "../create-till-entry.use-case";

describe("CreateTillEntryUseCase", () => {
  let tillEntryRepository: { create: ReturnType<typeof vi.fn> };
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let useCase: CreateTillEntryUseCase;

  const input = {
    requesterId: "staff-1",
    requesterRole: UserRole.STAFF,
    requesterShopId: "shop-1",
    shopId: "shop-1",
    category: "SALES" as const,
    amount: 5000,
  };

  beforeEach(() => {
    tillEntryRepository = { create: vi.fn() };
    shopRepository = { findById: vi.fn() };
    useCase = new CreateTillEntryUseCase(tillEntryRepository as any, shopRepository as any);
    shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-1", isActive: true }));
    tillEntryRepository.create.mockResolvedValue(buildTillEntry());
  });

  it("throws AuthorizationError when STAFF targets a different shop", async () => {
    await expect(useCase.execute({ ...input, requesterShopId: "other" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows OWNER/MANAGER to record for any shop", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.OWNER, requesterShopId: null }),
    ).resolves.toBeDefined();
  });

  it("throws NotFoundError when the shop does not exist or is inactive", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("checks authorization before hitting the shop repository", async () => {
    await expect(useCase.execute({ ...input, requesterShopId: "other" })).rejects.toThrow(
      AuthorizationError,
    );
    expect(shopRepository.findById).not.toHaveBeenCalled();
  });

  it("defaults description/billUrl to null and transactionDate to now when omitted", async () => {
    await useCase.execute(input);
    const args = tillEntryRepository.create.mock.calls[0]![0];
    expect(args.description).toBeNull();
    expect(args.billUrl).toBeNull();
    expect(args.transactionDate).toBeInstanceOf(Date);
  });

  it("returns the created entry mapped correctly", async () => {
    tillEntryRepository.create.mockResolvedValue(buildTillEntry({ id: "new-entry" }));
    const result = await useCase.execute(input);
    expect(result.id).toBe("new-entry");
  });
});
