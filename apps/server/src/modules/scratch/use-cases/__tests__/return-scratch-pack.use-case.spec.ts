// modules/scratch/use-cases/__tests__/return-scratch-pack.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildScratchPack } from "../../../../test/fixtures/scratch.fixture";
import { ReturnScratchPackUseCase } from "../return-scratch-pack.use-case";

describe("ReturnScratchPackUseCase", () => {
  let packRepo: {
    findById: ReturnType<typeof vi.fn>;
    updateStatusIfActive: ReturnType<typeof vi.fn>;
  };
  let useCase: ReturnScratchPackUseCase;
  const input = { requesterRole: UserRole.MANAGER, requesterShopId: null, packId: "pack-1" };

  beforeEach(() => {
    packRepo = { findById: vi.fn(), updateStatusIfActive: vi.fn() };
    useCase = new ReturnScratchPackUseCase(packRepo as any);
    packRepo.findById.mockResolvedValue(buildScratchPack({ status: "ACTIVE" }));
    packRepo.updateStatusIfActive.mockResolvedValue(buildScratchPack({ status: "RETURNED" }));
  });

  it("throws NotFoundError when the pack does not exist", async () => {
    packRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF returns a pack from a different shop", async () => {
    packRepo.findById.mockResolvedValue(buildScratchPack({ shopId: "other-shop" }));
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.STAFF, requesterShopId: "shop-1" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError when the pack is already FINISHED", async () => {
    packRepo.findById.mockResolvedValue(buildScratchPack({ status: "FINISHED" }));
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the pack is already RETURNED", async () => {
    packRepo.findById.mockResolvedValue(buildScratchPack({ status: "RETURNED" }));
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("sets status to RETURNED and stamps returnedAt", async () => {
    await useCase.execute(input);
    expect(packRepo.updateStatusIfActive).toHaveBeenCalledWith("pack-1", {
      status: "RETURNED",
      returnedAt: expect.any(Date),
    });
  });

  it("propagates BusinessRuleError when the repo guard rejects the return", async () => {
    packRepo.updateStatusIfActive.mockRejectedValue(
      new BusinessRuleError("Pack status changed before this update could be applied"),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });
});
