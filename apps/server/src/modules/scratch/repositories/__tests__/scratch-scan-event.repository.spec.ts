// modules/scratch/repositories/__tests__/scratch-scan-event.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildScratchScanEvent } from "../../../../test/fixtures/scratch.fixture";
import { ScratchScanEventRepository } from "../scratch-scan-event.repository";

describe("ScratchScanEventRepository", () => {
  let prisma: any;
  let repo: ScratchScanEventRepository;

  beforeEach(() => {
    prisma = {
      scratchScanEvent: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        groupBy: vi.fn(),
      },
    };
    repo = new ScratchScanEventRepository(prisma);
  });

  it("findActiveByPackAndShift filters out voided scans", async () => {
    prisma.scratchScanEvent.findFirst.mockResolvedValue(null);
    await repo.findActiveByPackAndShift("pack-1", new Date("2026-07-30"), "MORNING");
    expect(prisma.scratchScanEvent.findFirst).toHaveBeenCalledWith({
      where: {
        packId: "pack-1",
        scanDate: new Date("2026-07-30"),
        shiftPeriod: "MORNING",
        voidedAt: null,
      },
    });
  });

  it("findLatestForPack orders by sequenceNumber, not scanDate or createdAt", async () => {
    prisma.scratchScanEvent.findFirst.mockResolvedValue(null);
    await repo.findLatestForPack("pack-1");
    expect(prisma.scratchScanEvent.findFirst).toHaveBeenCalledWith({
      where: { packId: "pack-1", voidedAt: null },
      orderBy: { sequenceNumber: "desc" },
    });
  });

  it("voidScan updates the voided fields on the given scan", async () => {
    const voidedAt = new Date("2026-07-30T10:00:00.000Z");
    prisma.scratchScanEvent.update.mockResolvedValue(buildScratchScanEvent({ voidedAt }));
    await repo.voidScan("scan-1", { voidedById: "mgr-1", voidedAt, voidReason: "typo" });
    expect(prisma.scratchScanEvent.update).toHaveBeenCalledWith({
      where: { id: "scan-1" },
      data: { voidedById: "mgr-1", voidedAt, voidReason: "typo" },
    });
  });

  it("getSummaryByGame excludes voided scans from the aggregate", async () => {
    prisma.scratchScanEvent.groupBy.mockResolvedValue([]);
    await repo.getSummaryByGame("shop-1", new Date("2026-07-01"), new Date("2026-07-31"));
    const callArgs = prisma.scratchScanEvent.groupBy.mock.calls[0][0];
    expect(callArgs.where.voidedAt).toBeNull();
  });

  it("getSummaryByGame defaults missing sums to 0", async () => {
    prisma.scratchScanEvent.groupBy.mockResolvedValue([
      { gameId: "game-1", _sum: { ticketsSoldSincePrevious: null, revenueCents: null } },
    ]);
    await expect(repo.getSummaryByGame("shop-1", new Date(), new Date())).resolves.toEqual([
      { gameId: "game-1", ticketsSold: 0, revenueCents: 0 },
    ]);
  });
});
