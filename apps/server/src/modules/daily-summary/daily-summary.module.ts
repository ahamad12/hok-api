import { Module } from "@nestjs/common";
import { GatewayModule } from "../../infra/gateway/gateway.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { ExpenseModule } from "../expense/expense.module";
import { ScratchModule } from "../scratch/scratch.module";
import { ShopModule } from "../shop/shop.module";
import { TillEntryModule } from "../till-entry/till-entry.module";
import { DailySummaryController } from "./daily-summary.controller";
import { DailySummaryEventsListener } from "./listeners/daily-summary-events.listener";
import { DailySummaryRepository } from "./repositories/daily-summary.repository";
import { CreateDailySummaryUseCase } from "./use-cases/create-daily-summary.use-case";
import { FinalizeDailySummaryUseCase } from "./use-cases/finalize-daily-summary.use-case";
import { GetDailySummariesUseCase } from "./use-cases/get-daily-summaries.use-case";
import { GetDailySummaryByDateUseCase } from "./use-cases/get-daily-summary-by-date.use-case";
import { GetDailySummaryByIdUseCase } from "./use-cases/get-daily-summary-by-id.use-case";
import { VoidDailySummaryUseCase } from "./use-cases/void-daily-summary.use-case";

@Module({
  imports: [
    ShopModule,
    TillEntryModule,
    ScratchModule,
    DeliveryModule,
    ExpenseModule,
    GatewayModule,
  ],
  controllers: [DailySummaryController],
  providers: [
    DailySummaryRepository,
    CreateDailySummaryUseCase,
    GetDailySummariesUseCase,
    GetDailySummaryByIdUseCase,
    GetDailySummaryByDateUseCase,
    FinalizeDailySummaryUseCase,
    VoidDailySummaryUseCase,
    DailySummaryEventsListener,
  ],
})
export class DailySummaryModule {}
