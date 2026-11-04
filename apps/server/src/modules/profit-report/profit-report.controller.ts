import { Controller } from "@nestjs/common";
import { profitReportContract } from "@tapt-api/api/contracts/profit-report.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { toProfitReportResult, toProfitReportResults } from "./mappers/profit-report.mapper";
import { GenerateProfitReportUseCase } from "./use-cases/generate-profit-report.use-case";
import { GetLatestProfitReportUseCase } from "./use-cases/get-latest-profit-report.use-case";
import { GetProfitReportByIdUseCase } from "./use-cases/get-profit-report-by-id.use-case";
import { GetProfitReportsUseCase } from "./use-cases/get-profit-reports.use-case";
import { PreviewProfitReportUseCase } from "./use-cases/preview-profit-report.use-case";
import { VoidProfitReportUseCase } from "./use-cases/void-profit-report.use-case";

@Controller()
export class ProfitReportController {
  constructor(
    private readonly generateProfitReportUseCase: GenerateProfitReportUseCase,
    private readonly previewProfitReportUseCase: PreviewProfitReportUseCase,
    private readonly getProfitReportsUseCase: GetProfitReportsUseCase,
    private readonly getProfitReportByIdUseCase: GetProfitReportByIdUseCase,
    private readonly getLatestProfitReportUseCase: GetLatestProfitReportUseCase,
    private readonly voidProfitReportUseCase: VoidProfitReportUseCase,
  ) {}

  // No @Roles — STAFF isSupervisor gating happens inside the use-case.
  @TsRestHandler(profitReportContract.generate)
  generate(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: { shopId: string; periodStart: Date; periodEnd: Date } }) => {
      const report = await this.generateProfitReportUseCase.execute(user, body);
      return { status: 201 as const, body: toProfitReportResult(report) };
    };
  }

  @TsRestHandler(profitReportContract.preview)
  preview(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: { shopId: string; periodStart: Date; periodEnd: Date } }) => {
      const preview = await this.previewProfitReportUseCase.execute(user, query);
      return { status: 200 as const, body: preview };
    };
  }

  @TsRestHandler(profitReportContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: {
        shopId: string;
        periodStart?: Date;
        periodEnd?: Date;
        limit: number;
        offset: number;
      };
    }) => {
      const { reports, total } = await this.getProfitReportsUseCase.execute(user, query);
      return { status: 200 as const, body: { reports: toProfitReportResults(reports), total } };
    };
  }

  @TsRestHandler(profitReportContract.getLatest)
  getLatest(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: { shopId: string } }) => {
      const report = await this.getLatestProfitReportUseCase.execute(user, query.shopId);
      return { status: 200 as const, body: report ? toProfitReportResult(report) : null };
    };
  }

  @TsRestHandler(profitReportContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const report = await this.getProfitReportByIdUseCase.execute(user, params.id);
      return { status: 200 as const, body: toProfitReportResult(report) };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(profitReportContract["void"])
  voidReport(@CurrentUser() user: RequestUser) {
    return async ({ params, body }: { params: { id: string }; body: { voidReason: string } }) => {
      const report = await this.voidProfitReportUseCase.execute(user, params.id, body.voidReason);
      return { status: 200 as const, body: toProfitReportResult(report) };
    };
  }
}
