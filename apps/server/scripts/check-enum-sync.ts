/**
 * Ensures the UserRole enum values in the ts-rest contract match Prisma's schema.
 * If this fails, someone added a role to schema.prisma but forgot to update
 * the z.enum([...]) in packages/api/src/contracts/auth.contract.ts.
 */
import { UserRole } from "@tapt-api/db";

const contractRoles: readonly string[] = ["OWNER", "MANAGER", "STAFF"];
const prismaRoles = Object.values(UserRole);

const missing = contractRoles.filter((r) => !prismaRoles.includes(r));
const extra = prismaRoles.filter((r) => !contractRoles.includes(r));

if (missing.length > 0 || extra.length > 0) {
  console.error("\n  ❌ UserRole enum mismatch between Prisma schema and ts-rest contract\n");
  if (missing.length > 0) {
    console.error(`  Missing from contract: ${missing.join(", ")}`);
    console.error("  → Update packages/api/src/contracts/auth.contract.ts\n");
  }
  if (extra.length > 0) {
    console.error(`  Extra in contract (not in Prisma): ${extra.join(", ")}`);
    console.error("  → Remove from packages/api/src/contracts/auth.contract.ts\n");
  }
  process.exit(1);
}

console.log("  ✓ UserRole enum values match between Prisma schema and ts-rest contract");
