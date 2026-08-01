export type {
  License,
  LicenseRenewal,
  ScratchGame,
  ScratchPack,
  ScratchScanEvent,
  Shop,
  TillEntry,
  User,
} from "../prisma/generated/client";
export * from "../prisma/generated/enums";
export { DbModule } from "./db.module";
export { PrismaService } from "./prisma.service";
