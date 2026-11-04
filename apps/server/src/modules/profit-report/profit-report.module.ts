import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { GatewayModule } from "../../infra/gateway/gateway.module";
import { DailySummaryModule } from "../daily-summary/daily-summary.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { ExpenseModule } from "../expense/expense.module";
import { ScratchModule } from "../scratch/scratch.module";
import { ShopModule } from "../shop/shop.module";
import { ProfitReportAggregatorService } from "./aggregation/profit-report-aggregator.service";
import { ProfitReportEventsListener } from "./listeners/profit-report-events.listener";
import { ProfitReportPdfProcessor } from "./pdf/profit-report-pdf.processor";
import { ProfitReportPdfService } from "./pdf/profit-report-pdf.service";
import { PROFIT_REPORT_PDF_QUEUE } from "./profit-report.constants";
import { ProfitReportController } from "./profit-report.controller";
import { ProfitReportRepository } from "./repositories/profit-report.repository";
import { GenerateProfitReportUseCase } from "./use-cases/generate-profit-report.use-case";
import { GetLatestProfitReportUseCase } from "./use-cases/get-latest-profit-report.use-case";
import { GetProfitReportByIdUseCase } from "./use-cases/get-profit-report-by-id.use-case";
import { GetProfitReportsUseCase } from "./use-cases/get-profit-reports.use-case";
import { PreviewProfitReportUseCase } from "./use-cases/preview-profit-report.use-case";
import { VoidProfitReportUseCase } from "./use-cases/void-profit-report.use-case";

@Module({
  imports: [
    ShopModule,
    DailySummaryModule,
    ScratchModule,
    DeliveryModule,
    ExpenseModule,
    GatewayModule,
    BullModule.registerQueue({ name: PROFIT_REPORT_PDF_QUEUE }),
  ],
  controllers: [ProfitReportController],
  providers: [
    ProfitReportRepository,
    ProfitReportAggregatorService,
    ProfitReportPdfService,
    ProfitReportPdfProcessor,
    GenerateProfitReportUseCase,
    PreviewProfitReportUseCase,
    GetProfitReportsUseCase,
    GetProfitReportByIdUseCase,
    GetLatestProfitReportUseCase,
    VoidProfitReportUseCase,
    ProfitReportEventsListener,
  ],
})
export class ProfitReportModule {}
