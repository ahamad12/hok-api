import { Injectable } from "@nestjs/common";
import { type PeriodType, PrismaService, type ScratchScanEvent } from "@tapt-api/db";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../common/errors";
import { isUniqueViolation } from "../../../common/prisma/errors";

export interface CreateScratchScanEventData {
  packId: string;
  gameId: string;
  shopId: string;
  scanDate: Date;
  shiftPeriod: PeriodType;
  scannedSerial: string;
  ticketsSoldSincePrevious: number;
  ticketsRemaining: number;
  unitPriceCents: number;
  revenueCents: number;
  scannedById: string;
}

export interface VoidScratchScanData {
  voidedById: string;
  voidedAt: Date;
  voidReason: string;
}

export interface ScratchGameSalesTotal {
  gameId: string;
  ticketsSold: number;
  revenueCents: number;
}

@Injectable()
export class ScratchScanEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ScratchScanEvent | null> {
    return this.prisma.scratchScanEvent.findUnique({ where: { id } });
  }

  /**
   * Only considers non-voided scans. Fast-fail pre-check for the common
   * case; the load-bearing guarantee is the DB partial unique index
   * scratch_scan_events_pack_shift_active_key (migration
   * 20260806120000_scratch_scan_active_shift_unique), which permits at
   * most one non-voided scan per pack/date/shift. A voided scan no
   * longer occupies its slot, so a corrected re-scan is allowed once the
   * bad one is voided; a race-losing concurrent insert is rejected by
   * that index and surfaces as a ConflictError via
   * createScanAndFinishPackIfDepleted.
   */
  findActiveByPackAndShift(
    packId: string,
    scanDate: Date,
    shiftPeriod: PeriodType,
  ): Promise<ScratchScanEvent | null> {
    return this.prisma.scratchScanEvent.findFirst({
      where: { packId, scanDate, shiftPeriod, voidedAt: null },
    });
  }

  /**
   * Most recent NON-VOIDED scan for a pack — the baseline for deriving
   * the next scan's tickets-sold, and the only scan eligible to be
   * voided. Ordered by sequenceNumber (DB-assigned, monotonically
   * increasing insertion order) rather than scanDate/createdAt, so this
   * stays correct even for a backdated scan entered out of order.
   */
  findLatestForPack(packId: string): Promise<ScratchScanEvent | null> {
    return this.prisma.scratchScanEvent.findFirst({
      where: { packId, voidedAt: null },
      orderBy: { sequenceNumber: "desc" },
    });
  }

  /**
   * Single transaction: create the scan, and — only when finishPack is
   * true — flip the pack ACTIVE -> FINISHED. The pack update is guarded
   * (status: "ACTIVE") so a pack that changed status between the
   * use-case's read and this write (e.g. concurrently RETURNED) isn't
   * clobbered; count === 0 means that guard failed.
   *
   * The DB partial unique index scratch_scan_events_pack_shift_active_key
   * (migration 20260806120000_scratch_scan_active_shift_unique) rejects a
   * second concurrent non-voided scan for the same pack/date/shift with a
   * P2002, which is translated here to a ConflictError so the use-case's
   * existing error surface is preserved. Only the scan create can raise
   * P2002 in this transaction (the pack write is an updateMany); the
   * BusinessRuleError guard above still propagates unchanged.
   */
  async createScanAndFinishPackIfDepleted(
    data: CreateScratchScanEventData,
    finishPack: boolean,
  ): Promise<ScratchScanEvent> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const scan = await tx.scratchScanEvent.create({ data });

        if (finishPack) {
          const result = await tx.scratchPack.updateMany({
            where: { id: data.packId, status: "ACTIVE" },
            data: { status: "FINISHED", finishedAt: new Date() },
          });
          if (result.count === 0) {
            throw new BusinessRuleError(
              "Pack status changed while recording the scan (expected ACTIVE)",
            );
          }
        }

        return scan;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A scan has already been recorded for this pack in this shift");
      }
      throw error;
    }
  }

  /**
   * Single transaction that voids a scan and, only if it's still
   * currently the latest one for its pack, reverts a FINISHED pack back
   * to ACTIVE. The "latest scan" check and the void write happen as one
   * guarded conditional update (raw SQL — Prisma's updateMany can't
   * express "no newer sibling row exists" directly) rather than a
   * separate read-then-write, so a scan landing concurrently between the
   * use-case's own fast-fail check and this call can no longer slip
   * through: the DB re-checks "no newer non-voided scan" atomically with
   * the void itself.
   *
   * $executeRaw bypasses Prisma's @map mapping, so this targets the real
   * snake_case table/column names (schema.prisma:239,269) rather than
   * the camelCase model names used everywhere else in this file.
   *
   * On failure (0 rows affected) we re-read to tell already-voided apart
   * from superseded-by-a-newer-scan, so the use-case's existing error
   * types are preserved.
   */
  async voidScanAndRevertPackIfFinished(
    id: string,
    packId: string,
    sequenceNumber: number,
    data: VoidScratchScanData,
  ): Promise<ScratchScanEvent> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE "scratch_scan_events"
        SET "voided_by_id" = ${data.voidedById},
            "voided_at"    = ${data.voidedAt},
            "void_reason"  = ${data.voidReason}
        WHERE "id" = ${id}
          AND "voided_at" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "scratch_scan_events" AS later
            WHERE later."pack_id" = ${packId}
              AND later."sequence_number" > ${sequenceNumber}
              AND later."voided_at" IS NULL
          )
      `;

      if (updated === 0) {
        const current = await tx.scratchScanEvent.findUnique({ where: { id } });
        if (!current) throw new NotFoundError("ScratchScanEvent", id);
        if (current.voidedAt) throw new ConflictError("This scan has already been voided");
        throw new BusinessRuleError(
          "Only the most recent scan for a pack can be voided — later scans were derived from this one",
        );
      }

      await tx.scratchPack.updateMany({
        where: { id: packId, status: "FINISHED" },
        data: { status: "ACTIVE", finishedAt: null },
      });

      return tx.scratchScanEvent.findUniqueOrThrow({ where: { id } });
    });
  }

  /** Voided scans are excluded from every total — their revenue never
   *  happened, since the scan reporting it was thrown out. */
  async getSummaryByGame(
    shopId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<ScratchGameSalesTotal[]> {
    const result = await this.prisma.scratchScanEvent.groupBy({
      by: ["gameId"],
      where: { shopId, scanDate: { gte: dateFrom, lte: dateTo }, voidedAt: null },
      _sum: { ticketsSoldSincePrevious: true, revenueCents: true },
    });

    return result.map((r) => ({
      gameId: r.gameId,
      ticketsSold: r._sum.ticketsSoldSincePrevious ?? 0,
      revenueCents: r._sum.revenueCents ?? 0,
    }));
  }
}
