// modules/delivery/repositories/delivery.repository.ts
import { Injectable } from "@nestjs/common";
import {
  type Delivery,
  type DeliveryLineItem,
  type DeliveryPayment,
  PrismaService,
} from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

export interface DeliveryFilters {
  shopId: string;
  supplierId?: string;
  isVoided?: boolean;
}

export type DeliveryWithRelations = Delivery & {
  lineItems: DeliveryLineItem[];
  payments: DeliveryPayment[];
};

@Injectable()
export class DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<DeliveryWithRelations | null> {
    return this.prisma.delivery.findUnique({
      where: { id },
      include: { lineItems: true, payments: true },
    });
  }

  async findAll(
    filters: DeliveryFilters,
    pagination: { limit: number; offset: number },
  ): Promise<{ deliveries: Delivery[]; total: number }> {
    const where: Prisma.DeliveryWhereInput = { shopId: filters.shopId };
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.isVoided !== undefined) {
      where.voidedAt = filters.isVoided ? { not: null } : null;
    }

    const [deliveries, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        where,
        orderBy: { deliveredAt: "desc" },
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.delivery.count({ where }),
    ]);
    return { deliveries, total };
  }

  async getSupplierBalances(
    shopId: string,
  ): Promise<Array<{ supplierId: string; totalAmountCents: number; totalPaidCents: number }>> {
    const result = await this.prisma.delivery.groupBy({
      by: ["supplierId"],
      where: { shopId, voidedAt: null },
      _sum: { totalAmountCents: true, totalPaidCents: true },
    });
    return result.map((r) => ({
      supplierId: r.supplierId,
      totalAmountCents: r._sum.totalAmountCents ?? 0,
      totalPaidCents: r._sum.totalPaidCents ?? 0,
    }));
  }

  /**
   * Atomic void: only succeeds if the delivery is still un-voided AND has
   * no live (non-voided) payments against it. Returns the affected row
   * count — 0 means either it was already voided or a payment landed
   * between the caller's read and this write (the actual race the
   * plan's step 5 called out). The use case treats count===0 as failure
   * without needing to know which of the two reasons caused it.
   */
  async voidIfUnencumbered(id: string, voidedById: string, voidReason: string): Promise<number> {
    const result = await this.prisma.delivery.updateMany({
      where: { id, voidedAt: null, payments: { none: { voidedAt: null } } },
      data: { voidedAt: new Date(), voidedById, voidReason },
    });
    return result.count;
  }
}
