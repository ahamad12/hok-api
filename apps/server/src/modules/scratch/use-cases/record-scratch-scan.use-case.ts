import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../common/errors";
import {
  type ScratchScanEventResult,
  toScratchScanEventResult,
} from "../mappers/scratch-scan-event.mapper";
import { ScratchGameRepository } from "../repositories/scratch-game.repository";
import { ScratchPackRepository } from "../repositories/scratch-pack.repository";
import { ScratchScanEventRepository } from "../repositories/scratch-scan-event.repository";

export interface RecordScratchScanInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  packId: string;
  scanDate: Date;
  shiftPeriod: "MORNING" | "EVENING";
  scannedSerial: string; // 3-digit string, format already validated by the contract layer
}

@Injectable()
export class RecordScratchScanUseCase {
  constructor(
    private readonly scratchPackRepository: ScratchPackRepository,
    private readonly scratchGameRepository: ScratchGameRepository,
    private readonly scratchScanEventRepository: ScratchScanEventRepository,
  ) {}

  async execute(input: RecordScratchScanInput): Promise<ScratchScanEventResult> {
    const pack = await this.scratchPackRepository.findById(input.packId);
    if (!pack) throw new NotFoundError("ScratchPack", input.packId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== pack.shopId) {
      throw new AuthorizationError("Access denied for this pack");
    }

    // STATE MACHINE: only ACTIVE packs accept scans. This is the only
    // guard standing between "pack is done" and someone scanning a
    // pack that's already been swapped out or returned.
    if (pack.status !== "ACTIVE") {
      throw new BusinessRuleError(`Cannot record a scan for a pack with status ${pack.status}`);
    }

    // One scan per pack per shift — a second submission for the same
    // shift is a duplicate or a correction, and this endpoint doesn't
    // support corrections (no reversal concept for scans, unlike till
    // entries — a bad scan should be fixed by asking staff to re-scan
    // correctly next shift, not by editing history).
    const existingScan = await this.scratchScanEventRepository.findActiveByPackAndShift(
      input.packId,
      input.scanDate,
      input.shiftPeriod,
    );
    if (existingScan) {
      throw new ConflictError("A scan has already been recorded for this pack in this shift");
    }

    const game = await this.scratchGameRepository.findById(pack.gameId);
    if (!game) throw new NotFoundError("ScratchGame", pack.gameId);

    // ASCENDING SERIALS (confirmed): the top ticket's serial number goes
    // UP as tickets sell (000 -> 029). Cumulative tickets sold since the
    // pack was activated is (currentSerial - pack.serialStart); tickets
    // sold since the PREVIOUS scan is (currentSerial - previousSerial),
    // defaulting "previous" to serialStart on the pack's first scan.
    const startSerialNum = Number.parseInt(pack.serialStart, 10);
    const scannedSerialNum = Number.parseInt(input.scannedSerial, 10);

    const latestScan = await this.scratchScanEventRepository.findLatestForPack(input.packId);
    const previousSerialNum = latestScan
      ? Number.parseInt(latestScan.scannedSerial, 10)
      : startSerialNum;

    if (scannedSerialNum < previousSerialNum) {
      // With ascending serials a lower reading than last time is not a
      // valid state to derive sales from — misread, wrong pack, or
      // entered out of order.
      throw new BusinessRuleError(
        `Scanned serial (${input.scannedSerial}) is lower than the last recorded serial ` +
          `(${latestScan?.scannedSerial ?? pack.serialStart}) — serials should only increase as tickets sell`,
      );
    }

    const ticketsSoldSincePrevious = scannedSerialNum - previousSerialNum;
    const cumulativeSold = scannedSerialNum - startSerialNum;
    const ticketsRemainingRaw = game.ticketsPerPack - cumulativeSold;
    const ticketsRemaining = Math.max(ticketsRemainingRaw, 0);

    const scanEvent = await this.scratchScanEventRepository.create({
      packId: pack.id,
      gameId: pack.gameId,
      shopId: pack.shopId,
      scanDate: input.scanDate,
      shiftPeriod: input.shiftPeriod,
      scannedSerial: input.scannedSerial,
      ticketsSoldSincePrevious,
      ticketsRemaining,
      unitPriceCents: game.priceCents,
      revenueCents: ticketsSoldSincePrevious * game.priceCents,
      scannedById: input.requesterId,
    });

    // STATE MACHINE: ACTIVE -> FINISHED, the only transition into
    // FINISHED. Once every ticket is accounted for, the pack stops
    // accepting further scans (enforced by the guard above on the next
    // call), matching the physical reality that there's nothing left in
    // the bin to scan.
    if (ticketsRemainingRaw <= 0) {
      await this.scratchPackRepository.updateStatus(pack.id, {
        status: "FINISHED",
        finishedAt: new Date(),
      });
    }

    return toScratchScanEventResult(scanEvent);
  }
}
