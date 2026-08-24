// modules/delivery/repositories/delivery-payment.repository.ts
import { Injectable } from "@nestjs/common";
import { type DeliveryPayment, PrismaService } from "@tapt-api/db";

@Injectable()
export class DeliveryPaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<DeliveryPayment | null> {
    return this.prisma.deliveryPayment.findUnique({ where: { id } });
  }

  findByDelivery(deliveryId: string): Promise<DeliveryPayment[]> {
    return this.prisma.deliveryPayment.findMany({
      where: { deliveryId },
      orderBy: { paidAt: "desc" },
    });
  }
}
