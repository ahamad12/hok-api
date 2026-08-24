// modules/scratch/use-cases/__tests__/record-scratch-scan.use-case.spec.ts
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../../common/errors";
import {
  buildScratchGame,
  buildScratchPack,
  buildScratchScanEvent,
} from "../../../../test/fixtures/scratch.fixture";
import { RecordScratchScanUseCase } from "../record-scratch-scan.use-case";

describe("RecordScratchScanUseCase", () => {
  let packRepo: { findById: ReturnType<typeof vi.fn> };
  let gameRepo: { findById: ReturnType<typeof vi.fn> };
  let scanRepo: {
    findActiveByPackAndShift: ReturnType<typeof vi.fn>;
    findLatestForPack: ReturnType<typeof vi.fn>;
    createScanAndFinishPackIfDepleted: ReturnType<typeof vi.fn>;
  };
  let useCase: RecordScratchScanUseCase;

  const input = {
    requesterId: "staff-1",
    requesterRole: UserRole.STAFF,
    requesterShopId: "shop-1",
    packId: "pack-1",
    scanDate: new Date("2026-07-30T00:00:00.000Z"),
    shiftPeriod: "MORNING" as const,
    scannedSerial: "005",
  };

  beforeEach(() => {
    packRepo = { findById: vi.fn() };
    gameRepo = { findById: vi.fn() };
    scanRepo = {
      findActiveByPackAndShift: vi.fn(),
      findLatestForPack: vi.fn(),
      createScanAndFinishPackIfDepleted: vi.fn(),
    };
    useCase = new RecordScratchScanUseCase(packRepo as any, gameRepo as any, scanRepo as any);

    packRepo.findById.mockResolvedValue(buildScratchPack({ status: "ACTIVE", serialStart: "000" }));
    gameRepo.findById.mockResolvedValue(buildScratchGame({ ticketsPerPack: 30, priceCents: 500 }));
    scanRepo.findActiveByPackAndShift.mockResolvedValue(null);
    scanRepo.findLatestForPack.mockResolvedValue(null); // first scan on this pack
    scanRepo.createScanAndFinishPackIfDepleted.mockResolvedValue(buildScratchScanEvent());
  });

  it("throws NotFoundError when the pack does not exist", async () => {
    packRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF scans a pack from a different shop", async () => {
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

  it("throws ConflictError when a scan already exists for this pack/date/shift", async () => {
    scanRepo.findActiveByPackAndShift.mockResolvedValue(buildScratchScanEvent());
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("propagates ConflictError when the DB-enforced unique constraint rejects a race-losing scan", async () => {
    scanRepo.createScanAndFinishPackIfDepleted.mockRejectedValue(
      new ConflictError("A scan has already been recorded for this pack in this shift"),
    );
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("throws NotFoundError if the pack references a game that no longer exists", async () => {
    gameRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("on a first scan, derives tickets sold from serialStart (000 -> 005 = 5 sold)", async () => {
    await useCase.execute(input);
    const [data] = scanRepo.createScanAndFinishPackIfDepleted.mock.calls[0] ?? [];
    expect(data).toEqual(
      expect.objectContaining({ ticketsSoldSincePrevious: 5, ticketsRemaining: 25 }),
    );
  });

  it("on a later scan, derives tickets sold from the previous scan, not serialStart", async () => {
    scanRepo.findLatestForPack.mockResolvedValue(buildScratchScanEvent({ scannedSerial: "005" }));
    await useCase.execute({ ...input, scannedSerial: "012" });
    const [data] = scanRepo.createScanAndFinishPackIfDepleted.mock.calls[0] ?? [];
    expect(data).toEqual(
      expect.objectContaining({ ticketsSoldSincePrevious: 7, ticketsRemaining: 18 }),
    );
  });

  it("rejects a scanned serial lower than the previous scan (ascending-only)", async () => {
    scanRepo.findLatestForPack.mockResolvedValue(buildScratchScanEvent({ scannedSerial: "010" }));
    await expect(useCase.execute({ ...input, scannedSerial: "004" })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("allows a scan with the exact same serial as the previous one (0 sold, e.g. a quiet shift)", async () => {
    scanRepo.findLatestForPack.mockResolvedValue(buildScratchScanEvent({ scannedSerial: "005" }));
    await useCase.execute({ ...input, scannedSerial: "005" });
    const [data] = scanRepo.createScanAndFinishPackIfDepleted.mock.calls[0] ?? [];
    expect(data).toEqual(expect.objectContaining({ ticketsSoldSincePrevious: 0 }));
  });

  it("computes revenueCents as ticketsSold * the game price snapshotted at scan time", async () => {
    await useCase.execute(input);
    const [data] = scanRepo.createScanAndFinishPackIfDepleted.mock.calls[0] ?? [];
    expect(data).toEqual(expect.objectContaining({ unitPriceCents: 500, revenueCents: 5 * 500 }));
  });

  it("clamps ticketsRemaining at 0 rather than going negative when a pack is oversold", async () => {
    scanRepo.findLatestForPack.mockResolvedValue(buildScratchScanEvent({ scannedSerial: "025" }));
    await useCase.execute({ ...input, scannedSerial: "035" });
    const [data] = scanRepo.createScanAndFinishPackIfDepleted.mock.calls[0] ?? [];
    expect(data).toEqual(expect.objectContaining({ ticketsRemaining: 0 }));
  });

  it("passes finishPack=true once ticketsRemaining hits 0", async () => {
    scanRepo.findLatestForPack.mockResolvedValue(buildScratchScanEvent({ scannedSerial: "025" }));
    await useCase.execute({ ...input, scannedSerial: "030" });
    const [, finishPack] = scanRepo.createScanAndFinishPackIfDepleted.mock.calls[0] ?? [];
    expect(finishPack).toBe(true);
  });

  it("passes finishPack=false when tickets remain after the scan", async () => {
    await useCase.execute(input);
    const [, finishPack] = scanRepo.createScanAndFinishPackIfDepleted.mock.calls[0] ?? [];
    expect(finishPack).toBe(false);
  });

  it("records the scanning staff member, not anyone else, as scannedById", async () => {
    await useCase.execute(input);
    const [data] = scanRepo.createScanAndFinishPackIfDepleted.mock.calls[0] ?? [];
    expect(data).toEqual(expect.objectContaining({ scannedById: "staff-1" }));
  });
});
