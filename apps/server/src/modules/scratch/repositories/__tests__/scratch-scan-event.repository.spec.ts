// modules/scratch/repositories/__tests__/scratch-scan-event.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { buildScratchScanEvent } from "../../../../test/fixtures/scratch.fixture";
import { ScratchScanEventRepository } from "../scratch-scan-event.repository";

function buildTx() {
  return {
    scratchScanEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    scratchPack: {
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  };
}

describe("ScratchScanEventRepository", () => {
  let prisma: any;
  let tx: ReturnType<typeof buildTx>;
  let repo: ScratchScanEventRepository;

  beforeEach(() => {
    prisma = {
      scratchScanEvent: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        groupBy: vi.fn(),
      },
      $transaction: vi.fn((arg: any) => {
        tx = buildTx();
        return typeof arg === "function" ? Promise.resolve(arg(tx)) : Promise.all(arg);
      }),
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

  describe("createScanAndFinishPackIfDepleted", () => {
    const data = {
      packId: "pack-1",
      gameId: "game-1",
      shopId: "shop-1",
      scanDate: new Date("2026-07-30"),
      shiftPeriod: "MORNING" as const,
      scannedSerial: "030",
      ticketsSoldSincePrevious: 5,
      ticketsRemaining: 0,
      unitPriceCents: 500,
      revenueCents: 2500,
      scannedById: "staff-1",
    };

    it("creates the scan and leaves the pack alone when finishPack is false", async () => {
      const scan = buildScratchScanEvent();
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.scratchScanEvent.create.mockResolvedValue(scan);
        return arg(tx);
      });

      const result = await repo.createScanAndFinishPackIfDepleted(data, false);

      expect(tx.scratchScanEvent.create).toHaveBeenCalledWith({ data });
      expect(tx.scratchPack.updateMany).not.toHaveBeenCalled();
      expect(result).toBe(scan);
    });

    it("finishes the pack with a guarded update when finishPack is true and the guard succeeds", async () => {
      const scan = buildScratchScanEvent();
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.scratchScanEvent.create.mockResolvedValue(scan);
        tx.scratchPack.updateMany.mockResolvedValue({ count: 1 });
        return arg(tx);
      });

      await repo.createScanAndFinishPackIfDepleted(data, true);

      expect(tx.scratchPack.updateMany).toHaveBeenCalledWith({
        where: { id: "pack-1", status: "ACTIVE" },
        data: { status: "FINISHED", finishedAt: expect.any(Date) },
      });
    });

    it("throws BusinessRuleError when finishPack is true but the pack guard affects 0 rows", async () => {
      const scan = buildScratchScanEvent();
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.scratchScanEvent.create.mockResolvedValue(scan);
        tx.scratchPack.updateMany.mockResolvedValue({ count: 0 });
        return arg(tx);
      });

      await expect(repo.createScanAndFinishPackIfDepleted(data, true)).rejects.toThrow(
        BusinessRuleError,
      );
    });

    it("translates a P2002 from the DB unique constraint into a ConflictError", async () => {
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.scratchScanEvent.create.mockRejectedValue(
          buildUniqueViolationError(["pack_id", "scan_date", "shift_period"]),
        );
        return arg(tx);
      });

      await expect(repo.createScanAndFinishPackIfDepleted(data, false)).rejects.toThrow(
        ConflictError,
      );
      expect(tx.scratchPack.updateMany).not.toHaveBeenCalled();
    });

    it("rethrows Prisma errors that are not the shift-uniqueness violation", async () => {
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.scratchScanEvent.create.mockRejectedValue(new Error("connection reset"));
        return arg(tx);
      });

      await expect(repo.createScanAndFinishPackIfDepleted(data, false)).rejects.toThrow(
        "connection reset",
      );
    });
  });

  describe("voidScanAndRevertPackIfFinished", () => {
    const voidData = {
      voidedById: "mgr-1",
      voidedAt: new Date("2026-07-30T10:00:00.000Z"),
      voidReason: "Mistyped serial",
    };

    it("voids the scan and reverts a FINISHED pack to ACTIVE when the guarded raw update succeeds", async () => {
      const voided = buildScratchScanEvent({ ...voidData });
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.$executeRaw.mockResolvedValue(1);
        tx.scratchPack.updateMany.mockResolvedValue({ count: 1 });
        tx.scratchScanEvent.findUniqueOrThrow.mockResolvedValue(voided);
        return arg(tx);
      });

      const result = await repo.voidScanAndRevertPackIfFinished("scan-2", "pack-1", 1, voidData);

      expect(tx.scratchPack.updateMany).toHaveBeenCalledWith({
        where: { id: "pack-1", status: "FINISHED" },
        data: { status: "ACTIVE", finishedAt: null },
      });
      expect(tx.scratchScanEvent.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "scan-2" },
      });
      expect(result).toBe(voided);
    });

    it("interpolates the void data, id, pack id, and sequenceNumber into the raw SQL guard", async () => {
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.$executeRaw.mockResolvedValue(1);
        tx.scratchPack.updateMany.mockResolvedValue({ count: 0 });
        tx.scratchScanEvent.findUniqueOrThrow.mockResolvedValue(buildScratchScanEvent());
        return arg(tx);
      });

      await repo.voidScanAndRevertPackIfFinished("scan-2", "pack-1", 1, voidData);

      const values = (tx.$executeRaw.mock.calls[0] ?? []).slice(1);
      expect(values).toEqual([
        voidData.voidedById,
        voidData.voidedAt,
        voidData.voidReason,
        "scan-2",
        "pack-1",
        1,
      ]);
    });

    it("does not error when the raw update succeeds but the pack isn't FINISHED (revert guard is a no-op)", async () => {
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.$executeRaw.mockResolvedValue(1);
        tx.scratchPack.updateMany.mockResolvedValue({ count: 0 });
        tx.scratchScanEvent.findUniqueOrThrow.mockResolvedValue(buildScratchScanEvent());
        return arg(tx);
      });

      await expect(
        repo.voidScanAndRevertPackIfFinished("scan-2", "pack-1", 1, voidData),
      ).resolves.toBeDefined();
    });

    it("throws NotFoundError when the raw update affects 0 rows and the scan no longer exists", async () => {
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.$executeRaw.mockResolvedValue(0);
        tx.scratchScanEvent.findUnique.mockResolvedValue(null);
        return arg(tx);
      });

      await expect(
        repo.voidScanAndRevertPackIfFinished("scan-2", "pack-1", 1, voidData),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError when the raw update affects 0 rows because the scan was already voided", async () => {
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.$executeRaw.mockResolvedValue(0);
        tx.scratchScanEvent.findUnique.mockResolvedValue(
          buildScratchScanEvent({ voidedAt: new Date() }),
        );
        return arg(tx);
      });

      await expect(
        repo.voidScanAndRevertPackIfFinished("scan-2", "pack-1", 1, voidData),
      ).rejects.toThrow(ConflictError);
    });

    it("throws BusinessRuleError when the raw update affects 0 rows because a newer scan exists", async () => {
      prisma.$transaction.mockImplementationOnce((arg: any) => {
        tx = buildTx();
        tx.$executeRaw.mockResolvedValue(0);
        tx.scratchScanEvent.findUnique.mockResolvedValue(buildScratchScanEvent({ voidedAt: null }));
        return arg(tx);
      });

      await expect(
        repo.voidScanAndRevertPackIfFinished("scan-2", "pack-1", 1, voidData),
      ).rejects.toThrow(BusinessRuleError);
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
