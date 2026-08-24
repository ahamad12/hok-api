import { Injectable } from "@nestjs/common";
import type { UserRole } from "@tapt-api/db";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../common/errors";
import {
  type ScratchScanEventResult,
  toScratchScanEventResult,
} from "../mappers/scratch-scan-event.mapper";
import { ScratchScanEventRepository } from "../repositories/scratch-scan-event.repository";

export interface VoidScratchScanInput {
  requesterId: string;
  requesterRole: UserRole; // route restricts this to OWNER/MANAGER via @Roles — mirrors till's reverse endpoint
  scanId: string;
  voidReason: string;
}

@Injectable()
export class VoidScratchScanUseCase {
  constructor(private readonly scratchScanEventRepository: ScratchScanEventRepository) {}

  async execute(input: VoidScratchScanInput): Promise<ScratchScanEventResult> {
    const scan = await this.scratchScanEventRepository.findById(input.scanId);
    if (!scan) throw new NotFoundError("ScratchScanEvent", input.scanId);

    if (scan.voidedAt) {
      throw new ConflictError("This scan has already been voided");
    }

    // Fast-fail only: gives a quick, friendly error in the common case.
    // NOT the authoritative check — a scan landing concurrently after
    // this read would slip past it. The real enforcement of "only the
    // latest scan can be voided" happens atomically inside
    // voidScanAndRevertPackIfFinished below.
    const latest = await this.scratchScanEventRepository.findLatestForPack(scan.packId);
    if (!latest || latest.id !== scan.id) {
      throw new BusinessRuleError(
        "Only the most recent scan for a pack can be voided — later scans were derived from this one",
      );
    }

    // Every later scan derived its ticketsSoldSincePrevious from THIS
    // scan's scannedSerial — voiding an earlier one without recomputing
    // everything after it would silently corrupt those numbers. This
    // deliberately only covers the "caught it right after entering it"
    // case; voiding older scans needs its own design pass, not a default
    // baked in here.
    const voided = await this.scratchScanEventRepository.voidScanAndRevertPackIfFinished(
      scan.id,
      scan.packId,
      scan.sequenceNumber,
      {
        voidedById: input.requesterId,
        voidedAt: new Date(),
        voidReason: input.voidReason,
      },
    );

    return toScratchScanEventResult(voided);
  }
}
