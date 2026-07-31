import { Injectable } from "@nestjs/common";
import type { PeriodType, PrismaService, ScratchScanEvent } from "@tapt-api/db";

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
   * Only considers non-voided scans. A voided scan no longer occupies its
   * shift slot, so a corrected re-scan for the same pack/date/shift is
   * allowed once the bad one is voided — enforced here at the application
   * layer rather than a DB unique constraint, since a hard constraint
   * would block the very re-scan voiding exists to allow. Same tradeoff
   * as TillEntryRepository.findReversalFor: closes the common case, not a
   * true concurrent-request race.
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

  create(data: CreateScratchScanEventData): Promise<ScratchScanEvent> {
    return this.prisma.scratchScanEvent.create({ data });
  }

  voidScan(id: string, data: VoidScratchScanData): Promise<ScratchScanEvent> {
    return this.prisma.scratchScanEvent.update({ where: { id }, data });
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
