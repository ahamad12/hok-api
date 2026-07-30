// modules/till-entry/till-entry.module.ts
import { Module } from "@nestjs/common";
import { ShopModule } from "../shop/shop.module"; // for ShopRepository (CreateTillEntryUseCase)
import { TillEntryRepository } from "./repositories/till-entry.repository";
import { TillEntryController } from "./till-entry.controller";
import { CreateTillEntryUseCase } from "./use-cases/create-till-entry.use-case";
import { GetTillEntriesUseCase } from "./use-cases/get-till-entries.use-case";
import { GetTillEntryByIdUseCase } from "./use-cases/get-till-entry-by-id.use-case";
import { GetTillSummaryUseCase } from "./use-cases/get-till-summary.use-case";
import { ReverseTillEntryUseCase } from "./use-cases/reverse-till-entry.use-case";

@Module({
  imports: [ShopModule],
  controllers: [TillEntryController],
  providers: [
    TillEntryRepository,
    CreateTillEntryUseCase,
    GetTillEntriesUseCase,
    GetTillEntryByIdUseCase,
    ReverseTillEntryUseCase,
    GetTillSummaryUseCase,
  ],
  exports: [TillEntryRepository],
})
export class TillEntryModule {}
