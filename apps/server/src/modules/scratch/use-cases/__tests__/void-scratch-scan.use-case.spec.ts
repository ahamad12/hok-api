// modules/scratch/use-cases/__tests__/void-scratch-scan.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildScratchScanEvent } from "../../../../test/fixtures/scratch.fixture";
import { VoidScratchScanUseCase } from "../void-scratch-scan.use-case";

describe("VoidScratchScanUseCase", () => {
  let scanRepo: {
    findById: ReturnType<typeof vi.fn>;
    findLatestForPack: ReturnType<typeof vi.fn>;
    voidScanAndRevertPackIfFinished: ReturnType<typeof vi.fn>;
  };
  let useCase: VoidScratchScanUseCase;

  const input = {
    requesterId: "mgr-1",
    requesterRole: "MANAGER" as any,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    scanId: "scan-2",
    voidReason: "Mistyped serial",
  };

  beforeEach(() => {
    scanRepo = {
      findById: vi.fn(),
      findLatestForPack: vi.fn(),
      voidScanAndRevertPackIfFinished: vi.fn(),
    };
    useCase = new VoidScratchScanUseCase(scanRepo as any);

    // fixture default sequenceNumber: 1
    const scan = buildScratchScanEvent({ id: "scan-2", packId: "pack-1", voidedAt: null });
    scanRepo.findById.mockResolvedValue(scan);
    scanRepo.findLatestForPack.mockResolvedValue(scan); // this scan IS the latest (fast-fail check)
    scanRepo.voidScanAndRevertPackIfFinished.mockResolvedValue({
      ...scan,
      voidedAt: new Date(),
      voidedById: "mgr-1",
      voidReason: "Mistyped serial",
    });
  });

  it("throws NotFoundError when the scan does not exist", async () => {
    scanRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws ConflictError when the scan is already voided", async () => {
    scanRepo.findById.mockResolvedValue(buildScratchScanEvent({ voidedAt: new Date() }));
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("throws BusinessRuleError (fast-fail) when this scan is NOT the latest for its pack", async () => {
    scanRepo.findLatestForPack.mockResolvedValue(buildScratchScanEvent({ id: "scan-3" }));
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
    expect(scanRepo.voidScanAndRevertPackIfFinished).not.toHaveBeenCalled();
  });

  it("voids the scan via the repo with the scan id, pack id, sequenceNumber, and void data", async () => {
    await useCase.execute(input);
    expect(scanRepo.voidScanAndRevertPackIfFinished).toHaveBeenCalledWith("scan-2", "pack-1", 1, {
      voidedById: "mgr-1",
      voidedAt: expect.any(Date),
      voidReason: "Mistyped serial",
    });
  });

  it("returns the voided scan mapped through toScratchScanEventResult", async () => {
    const result = await useCase.execute(input);
    expect(result.voidedById).toBe("mgr-1");
    expect(result.voidReason).toBe("Mistyped serial");
  });
});
