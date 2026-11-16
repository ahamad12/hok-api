// packages/db/prisma/seed-demo.ts
//
// Dev-only demo data for screenshots and demo videos. Adds categories,
// suppliers, deliveries, tasks, tickets, scratch games and packs, till entries
// and expenses to "Main Street shop" under the iamahamad@gmail.com tenant.
//
// Additive only: nothing existing is updated or deleted. Re-running is a no-op
// once the marker supplier exists. Run `npm run db:seed` first so the staff
// accounts exist.
//
// Run from tapt-api/ with `npm run db:seed:demo`.
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import {
  DeliveryStatus,
  ExpenseBucket,
  PaymentMode,
  PrismaClient,
  ScratchPackLocation,
  ScratchPackStatus,
  TaskStatus,
  TicketPriority,
  TicketType,
  TillEntryCategory,
} from "./generated/client";

dotenv.config({
  path: fileURLToPath(new URL("../../../apps/server/.env", import.meta.url)),
});

const OWNER_EMAIL = "iamahamad@gmail.com";
const SHOP_NAME = "Main Street shop";
const MARKER_SUPPLIER = "Fresh Farms Produce";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (expected in apps/server/.env)");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    if (!owner) throw new Error(`Owner ${OWNER_EMAIL} not found`);
    const shop = await prisma.shop.findFirst({
      where: { ownerId: owner.id, name: SHOP_NAME },
    });
    if (!shop) throw new Error(`Shop "${SHOP_NAME}" not found`);

    const already = await prisma.supplier.findFirst({
      where: { shopId: shop.id, name: MARKER_SUPPLIER },
    });
    if (already) {
      console.log("Demo data already present, nothing to do.");
      return;
    }

    const staff = await prisma.user.findUnique({
      where: { email: "iamahamad+staff@gmail.com" },
    });
    const supervisor = await prisma.user.findUnique({
      where: { email: "iamahamad+supervisor@gmail.com" },
    });
    if (!staff || !supervisor) {
      throw new Error("Staff accounts missing: run `npm run db:seed` first");
    }
    const shopId = shop.id;

    // Categories and suppliers
    const [produce, drinks, tobacco] = await Promise.all(
      ["Fresh produce", "Drinks", "Tobacco"].map((name) =>
        prisma.category.upsert({
          where: { shopId_name: { shopId, name } },
          create: { shopId, name },
          update: {},
        }),
      ),
    );
    const supplierRows = [
      { name: MARKER_SUPPLIER, phone: "0771234567", categoryId: produce.id },
      { name: "Lanka Beverages", phone: "0779876543", categoryId: drinks.id },
      { name: "Kandy Tobacco Co", phone: "0812223344", categoryId: tobacco.id },
    ];
    const suppliers = [];
    for (const s of supplierRows) {
      suppliers.push(await prisma.supplier.create({ data: { shopId, ...s } }));
    }
    const [farms, bev] = suppliers;

    // Deliveries: one waiting to be checked in, two received (one part paid)
    const line = (productName: string, qty: number, unit: string, unitPriceCents: number) => ({
      productName,
      quantityOrdered: qty,
      quantityReceived: qty,
      unit,
      unitPriceCents,
      lineTotalCents: Math.round(qty * unitPriceCents),
    });
    const deliveries = [
      {
        supplierId: farms.id,
        status: DeliveryStatus.PENDING,
        hoursAgo: 1,
        lines: [line("Bananas", 20, "kg", 450), line("Tomatoes", 15, "kg", 600)],
        paid: 0,
      },
      {
        supplierId: bev.id,
        status: DeliveryStatus.RECEIVED,
        hoursAgo: 5,
        lines: [line("Cola 500ml", 48, "bottle", 180), line("Water 1L", 60, "bottle", 90)],
        paid: 7000,
      },
      {
        supplierId: farms.id,
        status: DeliveryStatus.RECEIVED,
        hoursAgo: 26,
        lines: [line("Onions", 25, "kg", 320)],
        paid: 8000,
      },
    ];
    for (const d of deliveries) {
      const total = d.lines.reduce((n, l) => n + l.lineTotalCents, 0);
      const received = d.status === DeliveryStatus.RECEIVED;
      const created = await prisma.delivery.create({
        data: {
          shopId,
          supplierId: d.supplierId,
          totalAmountCents: total,
          totalPaidCents: d.paid,
          status: d.status,
          deliveredById: staff.id,
          deliveredAt: hoursAgo(d.hoursAgo),
          receivedAt: received ? hoursAgo(d.hoursAgo - 0.5) : null,
          receivedById: received ? supervisor.id : null,
          lineItems: { create: d.lines },
        },
      });
      if (d.paid > 0) {
        await prisma.deliveryPayment.create({
          data: {
            deliveryId: created.id,
            amountCents: d.paid,
            paymentMode: PaymentMode.CASH,
            recordedById: supervisor.id,
            paidAt: hoursAgo(d.hoursAgo - 1),
          },
        });
      }
    }

    // Tasks
    await prisma.task.createMany({
      data: [
        {
          shopId,
          title: "Restock the chiller",
          description: "Cola and water first.",
          assigneeId: staff.id,
          status: TaskStatus.IN_PROGRESS,
          dueDate: daysFromNow(0),
          priority: 1,
          createdById: owner.id,
        },
        {
          shopId,
          title: "Wipe down shelves",
          assigneeId: staff.id,
          status: TaskStatus.NOT_STARTED,
          dueDate: daysFromNow(0),
          createdById: supervisor.id,
        },
        {
          shopId,
          title: "Count tobacco stock",
          assigneeId: supervisor.id,
          status: TaskStatus.NOT_STARTED,
          dueDate: daysFromNow(1),
          priority: 2,
          createdById: owner.id,
        },
        {
          shopId,
          title: "Take out the recycling",
          assigneeId: staff.id,
          status: TaskStatus.DONE,
          completedAt: hoursAgo(3),
          createdById: supervisor.id,
        },
      ],
    });

    // Tickets
    await prisma.ticket.createMany({
      data: [
        {
          shopId,
          type: TicketType.ISSUE,
          subject: "Chiller door not sealing",
          priority: TicketPriority.HIGH,
          createdById: staff.id,
          assigneeId: owner.id,
        },
        {
          shopId,
          type: TicketType.INSTRUCTION,
          subject: "Check ID on every tobacco sale",
          priority: TicketPriority.NORMAL,
          requiresAck: true,
          createdById: owner.id,
        },
        {
          shopId,
          type: TicketType.ANNOUNCEMENT,
          subject: "Delivery window moves to 7am from Monday",
          priority: TicketPriority.LOW,
          createdById: owner.id,
        },
      ],
    });

    // Scratch games and packs
    const [lucky, gold] = await Promise.all([
      prisma.scratchGame.create({
        data: {
          shopId,
          gameNumber: "1042",
          name: "Lucky 7s",
          priceCents: 200,
          ticketsPerPack: 100,
        },
      }),
      prisma.scratchGame.create({
        data: {
          shopId,
          gameNumber: "2218",
          name: "Golden Ticket",
          priceCents: 500,
          ticketsPerPack: 50,
        },
      }),
    ]);
    await prisma.scratchPack.createMany({
      data: [
        {
          gameId: lucky.id,
          shopId,
          serialStart: "000",
          status: ScratchPackStatus.ACTIVE,
          location: ScratchPackLocation.DISPLAY,
          receivedById: supervisor.id,
          receivedAt: hoursAgo(30),
        },
        {
          gameId: gold.id,
          shopId,
          serialStart: "000",
          status: ScratchPackStatus.ACTIVE,
          location: ScratchPackLocation.DISPLAY,
          receivedById: supervisor.id,
          receivedAt: hoursAgo(30),
        },
        {
          gameId: lucky.id,
          shopId,
          serialStart: "100",
          status: ScratchPackStatus.ACTIVE,
          location: ScratchPackLocation.BACKSTOCK,
          receivedById: supervisor.id,
          receivedAt: hoursAgo(30),
        },
      ],
    });

    // Till entries (amounts in cents)
    await prisma.tillEntry.createMany({
      data: [
        {
          shopId,
          category: TillEntryCategory.SALES,
          amount: 42500,
          description: "Morning sales",
          recordedById: staff.id,
          transactionDate: hoursAgo(6),
        },
        {
          shopId,
          category: TillEntryCategory.SALES,
          amount: 31800,
          description: "Lunch sales",
          recordedById: staff.id,
          transactionDate: hoursAgo(3),
        },
        {
          shopId,
          category: TillEntryCategory.EXPENSE,
          amount: 1500,
          description: "Ice for the chiller",
          recordedById: supervisor.id,
          transactionDate: hoursAgo(2),
        },
        {
          shopId,
          category: TillEntryCategory.DEPOSIT,
          amount: 20000,
          description: "Float top-up",
          recordedById: owner.id,
          transactionDate: hoursAgo(8),
        },
      ],
    });

    // Expenses
    const [utilities, rent] = await Promise.all([
      prisma.expenseCategory.create({
        data: { shopId, name: "Electricity", bucket: ExpenseBucket.UTILITY },
      }),
      prisma.expenseCategory.create({ data: { shopId, name: "Rent", bucket: ExpenseBucket.RENT } }),
    ]);
    await prisma.expense.createMany({
      data: [
        {
          shopId,
          categoryId: rent.id,
          amount: 150000,
          description: "November rent",
          expenseDate: new Date(),
          recordedById: owner.id,
        },
        {
          shopId,
          categoryId: utilities.id,
          amount: 18500,
          description: "Electricity bill",
          expenseDate: new Date(),
          recordedById: owner.id,
        },
      ],
    });

    console.log(`Demo data added to "${shop.name}" (${shop.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
