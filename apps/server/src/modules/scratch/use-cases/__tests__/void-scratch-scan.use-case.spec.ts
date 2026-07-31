// modules/scratch/use-cases/__tests__/void-scratch-scan.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildScratchPack, buildScratchScanEvent } from "../../../../test/fixtures/scratch.fixture";
import { VoidScratchScanUseCase } from "../void-scratch-scan.use-case";

describe("VoidScratchScanUseCase", () => {
  let scanRepo: {
    findById: ReturnType<typeof vi.fn>;
    findLatestForPack: ReturnType<typeof vi.fn>;
    voidScan: ReturnType<typeof vi.fn>;
  };
  let packRepo: { findById: ReturnType<typeof vi.fn>; updateStatus: ReturnType<typeof vi.fn> };
  let useCase: VoidScratchScanUseCase;

  const input = {
    requesterId: "mgr-1",
    requesterRole: "MANAGER" as any,
    scanId: "scan-2",
    voidReason: "Mistyped serial",
  };

  beforeEach(() => {
    scanRepo = { findById: vi.fn(), findLatestForPack: vi.fn(), voidScan: vi.fn() };
    packRepo = { findById: vi.fn(), updateStatus: vi.fn() };
    useCase = new VoidScratchScanUseCase(scanRepo as any, packRepo as any);

    const scan = buildScratchScanEvent({ id: "scan-2", packId: "pack-1", voidedAt: null });
    scanRepo.findById.mockResolvedValue(scan);
    scanRepo.findLatestForPack.mockResolvedValue(scan); // this scan IS the latest
    scanRepo.voidScan.mockResolvedValue({
      ...scan,
      voidedAt: new Date(),
      voidedById: "mgr-1",
      voidReason: "Mistyped serial",
    });
    packRepo.findById.mockResolvedValue(buildScratchPack({ status: "ACTIVE" }));
  });

  it("throws NotFoundError when the scan does not exist", async () => {
    scanRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws ConflictError when the scan is already voided", async () => {
    scanRepo.findById.mockResolvedValue(buildScratchScanEvent({ voidedAt: new Date() }));
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("throws BusinessRuleError when this scan is NOT the latest for its pack", async () => {
    scanRepo.findLatestForPack.mockResolvedValue(buildScratchScanEvent({ id: "scan-3" })); // a newer scan exists
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("voids the scan with the requester, timestamp, and reason", async () => {
    await useCase.execute(input);
    expect(scanRepo.voidScan).toHaveBeenCalledWith("scan-2", {
      voidedById: "mgr-1",
      voidedAt: expect.any(Date),
      voidReason: "Mistyped serial",
    });
  });

  it("reverts a FINISHED pack back to ACTIVE when its finishing scan is voided", async () => {
    packRepo.findById.mockResolvedValue(
      buildScratchPack({ status: "FINISHED", finishedAt: new Date() }),
    );
    await useCase.execute(input);
    expect(packRepo.updateStatus).toHaveBeenCalledWith("pack-1", {
      status: "ACTIVE",
      finishedAt: null,
    });
  });

  it("does NOT touch pack status when the pack is still ACTIVE", async () => {
    await useCase.execute(input);
    expect(packRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("returns the voided scan mapped through toScratchScanEventResult", async () => {
    const result = await useCase.execute(input);
    expect(result.voidedById).toBe("mgr-1");
    expect(result.voidReason).toBe("Mistyped serial");
  });
});
