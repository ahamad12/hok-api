// modules/delivery/repositories/delivery.repository.ts
import { Injectable } from "@nestjs/common";
import {
  type Delivery,
  type DeliveryLineItem,
  type DeliveryPayment,
  PrismaService,
} from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { BusinessRuleError } from "../../../common/errors";
import { type DeliveryPaymentStatus, getDeliveryPaymentStatus } from "../mappers/delivery.mapper";

export type { DeliveryPaymentStatus };

export interface DeliveryFilters {
  shopId: string;
  supplierId?: string;
  isVoided?: boolean;
  paymentStatus?: DeliveryPaymentStatus;
}

export type DeliveryWithRelations = Delivery & {
  lineItems: DeliveryLineItem[];
  payments: DeliveryPayment[];
};

export interface CreateDeliveryLineItemInput {
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unit: string;
  unitPriceCents: number;
  lineTotalCents: number;
  discrepancyNote: string | null;
}

export interface CreateDeliveryInput {
  shopId: string;
  supplierId: string;
  billUrl: string | null;
  totalAmountCents: number;
  deliveredById: string;
  deliveredAt: Date;
  lineItems: CreateDeliveryLineItemInput[];
}

@Injectable()
export class DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<DeliveryWithRelations | null> {
    return this.prisma.delivery.findUnique({
      where: { id },
      include: { lineItems: true, payments: true },
    });
  }

  async createWithLineItems(input: CreateDeliveryInput): Promise<Delivery> {
    return await this.prisma.delivery.create({
      data: {
        shopId: input.shopId,
        supplierId: input.supplierId,
        billUrl: input.billUrl,
        totalAmountCents: input.totalAmountCents,
        totalPaidCents: 0,
        deliveredById: input.deliveredById,
        deliveredAt: input.deliveredAt,
        lineItems: {
          create: input.lineItems.map((item) => ({
            productName: item.productName,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
            unit: item.unit,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
            discrepancyNote: item.discrepancyNote,
          })),
        },
      },
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

    // paymentStatus is derived from totalPaidCents vs totalAmountCents — a
    // column-to-column comparison Prisma's WhereInput can't express without
    // $queryRaw. When filtered, fetch all matching rows, derive status via
    // getDeliveryPaymentStatus, then paginate in memory so total/limit/offset
    // stay consistent with the filtered set. Without the filter, use the
    // optimized $transaction([findMany, count]) path below.
    if (filters.paymentStatus) {
      const candidates = await this.prisma.delivery.findMany({
        where,
        orderBy: { deliveredAt: "desc" },
      });
      const filtered = candidates.filter(
        (d) => getDeliveryPaymentStatus(d) === filters.paymentStatus,
      );
      const total = filtered.length;
      const deliveries = filtered.slice(pagination.offset, pagination.offset + pagination.limit);
      return { deliveries, total };
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

  async getTotalsByDeliveredAtDate(
    shopId: string,
    date: Date,
  ): Promise<{
    totalAmountCents: number;
    bySupplier: { supplierId: string; totalAmountCents: number; totalPaidCents: number }[];
  }> {
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
    );
    const dayEnd = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
    );

    const rows = await this.prisma.delivery.groupBy({
      by: ["supplierId"],
      where: { shopId, deliveredAt: { gte: dayStart, lte: dayEnd }, voidedAt: null },
      _sum: { totalAmountCents: true, totalPaidCents: true },
    });

    const bySupplier = rows.map((r) => ({
      supplierId: r.supplierId,
      totalAmountCents: r._sum.totalAmountCents ?? 0,
      totalPaidCents: r._sum.totalPaidCents ?? 0,
    }));

    return {
      totalAmountCents: bySupplier.reduce((sum, s) => sum + s.totalAmountCents, 0),
      bySupplier,
    };
  }

  /**
   * Atomic void: only succeeds if the delivery is still un-voided AND has
   * no live (non-voided) payments against it. Returns the affected row
   * count — 0 means either it was already voided or a payment landed
   * between the caller's read and this write. The use case treats
   * count===0 as failure without needing to know which reason caused it.
   */
  async voidIfUnencumbered(id: string, voidedById: string, voidReason: string): Promise<number> {
    const result = await this.prisma.delivery.updateMany({
      where: { id, voidedAt: null, payments: { none: { voidedAt: null } } },
      data: { voidedAt: new Date(), voidedById, voidReason },
    });
    return result.count;
  }

  /**
   * Records a payment and atomically bumps totalPaidCents, guarded by a
   * conditional updateMany (WHERE totalPaidCents <= limit) so a
   * concurrent payment landing between the caller's balance check and
   * this write can't push the sum past totalAmountCents. count===0 means
   * that race happened; the payment insert rolls back with it since both
   * writes share this transaction.
   */
  async recordPaymentIfWithinBalance(
    deliveryId: string,
    totalAmountCents: number,
    paymentData: Omit<Prisma.DeliveryPaymentUncheckedCreateInput, "deliveryId">,
  ): Promise<{ delivery: Delivery; payment: DeliveryPayment }> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.deliveryPayment.create({
        data: { ...paymentData, deliveryId },
      });

      const result = await tx.delivery.updateMany({
        where: {
          id: deliveryId,
          totalPaidCents: { lte: totalAmountCents - paymentData.amountCents },
        },
        data: { totalPaidCents: { increment: paymentData.amountCents } },
      });

      if (result.count === 0) {
        throw new BusinessRuleError(
          "Payment would exceed the amount owed (concurrent payment detected)",
        );
      }

      const delivery = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
      return { delivery, payment };
    });
  }

  /**
   * Voids a payment, guarded by a conditional updateMany (WHERE
   * voidedAt IS NULL) so two concurrent void requests can't both
   * succeed — only the one that actually flips voidedAt wins — then
   * decrements totalPaidCents on the delivery in the same transaction.
   */
  async voidPaymentIfUnvoided(
    paymentId: string,
    deliveryId: string,
    amountCents: number,
    voidData: { voidedById: string; voidReason: string },
  ): Promise<{ delivery: Delivery; payment: DeliveryPayment }> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.deliveryPayment.updateMany({
        where: { id: paymentId, voidedAt: null },
        data: { voidedAt: new Date(), ...voidData },
      });

      if (result.count === 0) {
        throw new BusinessRuleError("This payment has already been voided");
      }

      const delivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: { totalPaidCents: { decrement: amountCents } },
      });
      const payment = await tx.deliveryPayment.findUniqueOrThrow({ where: { id: paymentId } });

      return { delivery, payment };
    });
  }
}
