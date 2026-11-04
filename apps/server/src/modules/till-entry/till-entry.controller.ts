// modules/till-entry/till-entry.controller.ts
import { Controller } from "@nestjs/common";
import { tillEntryContract } from "@tapt-api/api/contracts/till-entry.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import {
  type CreateTillEntryInput,
  CreateTillEntryUseCase,
} from "./use-cases/create-till-entry.use-case";
import {
  type GetTillEntriesInput,
  GetTillEntriesUseCase,
} from "./use-cases/get-till-entries.use-case";
import { GetTillEntryByIdUseCase } from "./use-cases/get-till-entry-by-id.use-case";
import {
  type GetTillSummaryInput,
  GetTillSummaryUseCase,
} from "./use-cases/get-till-summary.use-case";
import {
  type ReverseTillEntryInput,
  ReverseTillEntryUseCase,
} from "./use-cases/reverse-till-entry.use-case";

@Controller()
export class TillEntryController {
  constructor(
    private readonly createTillEntryUseCase: CreateTillEntryUseCase,
    private readonly getTillEntriesUseCase: GetTillEntriesUseCase,
    private readonly getTillEntryByIdUseCase: GetTillEntryByIdUseCase,
    private readonly reverseTillEntryUseCase: ReverseTillEntryUseCase,
    private readonly getTillSummaryUseCase: GetTillSummaryUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(tillEntryContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({
      body,
    }: {
      body: Omit<CreateTillEntryInput, "requesterId" | "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.createTillEntryUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(tillEntryContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetTillEntriesInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getTillEntriesUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(tillEntryContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getTillEntryByIdUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        entryId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(tillEntryContract.reverse)
  reverse(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<
        ReverseTillEntryInput,
        "requesterId" | "requesterRole" | "requesterShopId" | "entryId"
      >;
    }) => {
      const result = await this.reverseTillEntryUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        entryId: params.id,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(tillEntryContract.getSummary)
  getSummary(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetTillSummaryInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getTillSummaryUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }
}
