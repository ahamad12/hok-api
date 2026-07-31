// modules/scratch/use-cases/__tests__/move-scratch-pack.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildScratchPack } from "../../../../test/fixtures/scratch.fixture";
import { MoveScratchPackUseCase } from "../move-scratch-pack.use-case";

describe("MoveScratchPackUseCase", () => {
  let packRepo: { findById: ReturnType<typeof vi.fn>; updateLocation: ReturnType<typeof vi.fn> };
  let useCase: MoveScratchPackUseCase;
  const input = {
    requesterRole: UserRole.STAFF,
    requesterShopId: "shop-1",
    packId: "pack-1",
    location: "BACKSTOCK" as const,
  };

  beforeEach(() => {
    packRepo = { findById: vi.fn(), updateLocation: vi.fn() };
    useCase = new MoveScratchPackUseCase(packRepo as any);
    packRepo.findById.mockResolvedValue(
      buildScratchPack({ status: "ACTIVE", location: "DISPLAY" }),
    );
    packRepo.updateLocation.mockResolvedValue(buildScratchPack({ location: "BACKSTOCK" }));
  });

  it("throws NotFoundError when the pack does not exist", async () => {
    packRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError for STAFF on a different shop", async () => {
    packRepo.findById.mockResolvedValue(buildScratchPack({ shopId: "other-shop" }));
    await expect(useCase.execute(input)).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError when the pack is FINISHED", async () => {
    packRepo.findById.mockResolvedValue(buildScratchPack({ status: "FINISHED" }));
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the pack is RETURNED", async () => {
    packRepo.findById.mockResolvedValue(buildScratchPack({ status: "RETURNED" }));
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("updates the location field only, with no separate movement log", async () => {
    await useCase.execute(input);
    expect(packRepo.updateLocation).toHaveBeenCalledWith("pack-1", "BACKSTOCK");
  });
});
