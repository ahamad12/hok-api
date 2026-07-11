import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@tapt-api/env/server";

import { Prisma, PrismaClient } from "../prisma/generated/client";

export { Prisma };

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;
