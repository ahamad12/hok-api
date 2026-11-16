// packages/db/prisma/seed.ts
//
// Dev-only seeder for manual login testing. Adds a supervisory STAFF account
// and a plain STAFF account inside the existing iamahamad@gmail.com tenant,
// both assigned to "Main Street shop".
//
// Deliberately direct DB writes: public /auth/register only creates OWNERs and
// MANAGER/STAFF normally arrive through an invitation email, which a seeder
// cannot accept. The owner row itself is never modified.
//
// Run from tapt-api/ with `npm run db:seed`. Safe to re-run: users are upserted
// by normalized email, and the password/tokenVersion are reset each time.
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PrismaClient, UserRole } from "./generated/client";

dotenv.config({
  path: fileURLToPath(new URL("../../../apps/server/.env", import.meta.url)),
});

const OWNER_EMAIL = "iamahamad@gmail.com";
const SHOP_NAME = "Main Street shop";
const SEED_PASSWORD = "Tapt@12345";
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

const SEED_USERS = [
  {
    email: "iamahamad+supervisor@gmail.com",
    displayName: "Hamad Supervisor",
    isSupervisor: true,
  },
  {
    email: "iamahamad+staff@gmail.com",
    displayName: "Hamad Staff",
    isSupervisor: false,
  },
] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (expected in apps/server/.env)");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    if (!owner) {
      throw new Error(`Owner ${OWNER_EMAIL} not found — create it before seeding`);
    }

    const shop = await prisma.shop.findFirst({
      where: { ownerId: owner.id, name: SHOP_NAME },
    });
    if (!shop) {
      throw new Error(`Shop "${SHOP_NAME}" not found under ${OWNER_EMAIL}`);
    }

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

    console.log(`Tenant: ${owner.email} (${owner.id})`);
    console.log(`Shop:   ${shop.name} (${shop.id})`);

    for (const seeded of SEED_USERS) {
      const user = await prisma.user.upsert({
        where: { email: seeded.email },
        create: {
          email: seeded.email,
          displayName: seeded.displayName,
          passwordHash,
          role: UserRole.STAFF,
          isSupervisor: seeded.isSupervisor,
          isActive: true,
          shopId: shop.id,
          ownerId: owner.id,
        },
        update: {
          displayName: seeded.displayName,
          passwordHash,
          role: UserRole.STAFF,
          isSupervisor: seeded.isSupervisor,
          isActive: true,
          shopId: shop.id,
          ownerId: owner.id,
          // Password reset must kill existing sessions for this account; the
          // access-token verifier compares the JWT claim against this value.
          tokenVersion: { increment: 1 },
        },
      });

      const label = user.isSupervisor ? "STAFF (supervisor)" : "STAFF";
      console.log(`  ${label.padEnd(18)} ${user.email}  id=${user.id}`);
    }

    console.log("");
    console.log(`Password for both seeded accounts: ${SEED_PASSWORD}`);
    console.log("Owner account was not modified.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
