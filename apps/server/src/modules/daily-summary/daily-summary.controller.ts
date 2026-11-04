import { Controller } from "@nestjs/common";
import { dailySummaryContract } from "@tapt-api/api/contracts/daily-summary.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { UseCaseArg } from "../../common/types/use-case-arg.type";
import { toDailySummaryResult, toDailySummaryResults } from "./mappers/daily-summary.mapper";
import { CreateDailySummaryUseCase } from "./use-cases/create-daily-summary.use-case";
import { FinalizeDailySummaryUseCase } from "./use-cases/finalize-daily-summary.use-case";
import { GetDailySummariesUseCase } from "./use-cases/get-daily-summaries.use-case";
import { GetDailySummaryByDateUseCase } from "./use-cases/get-daily-summary-by-date.use-case";
import { GetDailySummaryByIdUseCase } from "./use-cases/get-daily-summary-by-id.use-case";
import { VoidDailySummaryUseCase } from "./use-cases/void-daily-summary.use-case";

@Controller()
export class DailySummaryController {
  constructor(
    private readonly createDailySummary: CreateDailySummaryUseCase,
    private readonly getDailySummaries: GetDailySummariesUseCase,
    private readonly getDailySummaryById: GetDailySummaryByIdUseCase,
    private readonly getDailySummaryByDate: GetDailySummaryByDateUseCase,
    private readonly finalizeDailySummary: FinalizeDailySummaryUseCase,
    private readonly voidDailySummary: VoidDailySummaryUseCase,
  ) {}

  // No @Roles here — STAFF isSupervisor gating happens inside the
  // use-case, since @Roles can't express "STAFF but only if isSupervisor."
  @TsRestHandler(dailySummaryContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: UseCaseArg<CreateDailySummaryUseCase, 1> }) => {
      const summary = await this.createDailySummary.execute(user, body);
      return { status: 201 as const, body: toDailySummaryResult(summary) };
    };
  }

  @TsRestHandler(dailySummaryContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: UseCaseArg<GetDailySummariesUseCase, 1> }) => {
      const { summaries, total } = await this.getDailySummaries.execute(user, query);
      return { status: 200 as const, body: { summaries: toDailySummaryResults(summaries), total } };
    };
  }

  @TsRestHandler(dailySummaryContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const summary = await this.getDailySummaryById.execute(user, params.id);
      return { status: 200 as const, body: toDailySummaryResult(summary) };
    };
  }

  @TsRestHandler(dailySummaryContract.getByDate)
  getByDate(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { shopId: string; date: string } }) => {
      const summary = await this.getDailySummaryByDate.execute(
        user,
        params.shopId,
        new Date(params.date),
      );
      return { status: 200 as const, body: toDailySummaryResult(summary) };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(dailySummaryContract.finalize)
  finalize(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const summary = await this.finalizeDailySummary.execute(user, params.id);
      return { status: 200 as const, body: toDailySummaryResult(summary) };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(dailySummaryContract["void"])
  voidSummary(@CurrentUser() user: RequestUser) {
    return async ({ params, body }: { params: { id: string }; body: { voidReason: string } }) => {
      const summary = await this.voidDailySummary.execute(user, params.id, body.voidReason);
      return { status: 200 as const, body: toDailySummaryResult(summary) };
    };
  }
}
