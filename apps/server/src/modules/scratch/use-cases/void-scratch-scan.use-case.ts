import { Injectable } from "@nestjs/common";
import type { UserRole } from "@tapt-api/db";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../common/errors";
import {
  type ScratchScanEventResult,
  toScratchScanEventResult,
} from "../mappers/scratch-scan-event.mapper";
import { ScratchPackRepository } from "../repositories/scratch-pack.repository";
import { ScratchScanEventRepository } from "../repositories/scratch-scan-event.repository";

export interface VoidScratchScanInput {
  requesterId: string;
  requesterRole: UserRole; // route restricts this to OWNER/MANAGER via @Roles — mirrors till's reverse endpoint
  scanId: string;
  voidReason: string;
}

@Injectable()
export class VoidScratchScanUseCase {
  constructor(
    private readonly scratchScanEventRepository: ScratchScanEventRepository,
    private readonly scratchPackRepository: ScratchPackRepository,
  ) {}

  async execute(input: VoidScratchScanInput): Promise<ScratchScanEventResult> {
    const scan = await this.scratchScanEventRepository.findById(input.scanId);
    if (!scan) throw new NotFoundError("ScratchScanEvent", input.scanId);

    if (scan.voidedAt) {
      throw new ConflictError("This scan has already been voided");
    }

    // Only the most recent (non-voided) scan for a pack can be voided.
    // Every later scan derived its ticketsSoldSincePrevious from THIS
    // scan's scannedSerial — voiding an earlier one without recomputing
    // everything after it would silently corrupt those numbers. This
    // deliberately only covers the "caught it right after entering it"
    // case; voiding older scans needs its own design pass, not a default
    // baked in here.
    const latest = await this.scratchScanEventRepository.findLatestForPack(scan.packId);
    if (!latest || latest.id !== scan.id) {
      throw new BusinessRuleError(
        "Only the most recent scan for a pack can be voided — later scans were derived from this one",
      );
    }

    const voided = await this.scratchScanEventRepository.voidScan(scan.id, {
      voidedById: input.requesterId,
      voidedAt: new Date(),
      voidReason: input.voidReason,
    });

    // If this scan was the one that auto-finished the pack — the only
    // way a pack reaches FINISHED — voiding it must revert the pack to
    // ACTIVE too, or it's left FINISHED with no scan actually backing
    // that state, and permanently unable to accept further scans. Safe
    // to do unconditionally here BECAUSE of the latest-only constraint
    // above: a FINISHED pack's status can only have come from its own
    // latest scan.
    const pack = await this.scratchPackRepository.findById(scan.packId);
    if (pack && pack.status === "FINISHED") {
      await this.scratchPackRepository.updateStatus(pack.id, {
        status: "ACTIVE",
        finishedAt: null,
      });
    }

    return toScratchScanEventResult(voided);
  }
}
