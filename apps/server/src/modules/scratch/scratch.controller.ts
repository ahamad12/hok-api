import { Controller } from "@nestjs/common";
import {
  scratchGameContract,
  scratchPackContract,
  scratchScanContract,
  scratchSummaryContract,
} from "@tapt-api/api/contracts/scratch.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import {
  type CreateScratchGameInput,
  CreateScratchGameUseCase,
} from "./use-cases/create-scratch-game.use-case";
import { GetScratchGameByIdUseCase } from "./use-cases/get-scratch-game-by-id.use-case";
import {
  type GetScratchGamesInput,
  GetScratchGamesUseCase,
} from "./use-cases/get-scratch-games.use-case";
import { GetScratchPackByIdUseCase } from "./use-cases/get-scratch-pack-by-id.use-case";
import {
  type GetScratchPacksInput,
  GetScratchPacksUseCase,
} from "./use-cases/get-scratch-packs.use-case";
import {
  type GetScratchSalesSummaryInput,
  GetScratchSalesSummaryUseCase,
} from "./use-cases/get-scratch-sales-summary.use-case";
import {
  type GetScratchScansInput,
  GetScratchScansUseCase,
} from "./use-cases/get-scratch-scans.use-case";
import { MoveScratchPackUseCase } from "./use-cases/move-scratch-pack.use-case";
import {
  type ReceiveScratchPackInput,
  ReceiveScratchPackUseCase,
} from "./use-cases/receive-scratch-pack.use-case";
import {
  type RecordScratchScanInput,
  RecordScratchScanUseCase,
} from "./use-cases/record-scratch-scan.use-case";
import { ReturnScratchPackUseCase } from "./use-cases/return-scratch-pack.use-case";
import { VoidScratchScanUseCase } from "./use-cases/void-scratch-scan.use-case";

@Controller()
export class ScratchGameController {
  constructor(
    private readonly createScratchGameUseCase: CreateScratchGameUseCase,
    private readonly getScratchGamesUseCase: GetScratchGamesUseCase,
    private readonly getScratchGameByIdUseCase: GetScratchGameByIdUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(scratchGameContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({
      body,
    }: {
      body: Omit<CreateScratchGameInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.createScratchGameUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(scratchGameContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetScratchGamesInput, "requesterRole" | "requesterShopId">;
    }) => {
      const games = await this.getScratchGamesUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: { games } };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(scratchGameContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getScratchGameByIdUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        gameId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }
}

@Controller()
export class ScratchPackController {
  constructor(
    private readonly receiveScratchPackUseCase: ReceiveScratchPackUseCase,
    private readonly getScratchPacksUseCase: GetScratchPacksUseCase,
    private readonly getScratchPackByIdUseCase: GetScratchPackByIdUseCase,
    private readonly moveScratchPackUseCase: MoveScratchPackUseCase,
    private readonly returnScratchPackUseCase: ReturnScratchPackUseCase,
    private readonly recordScratchScanUseCase: RecordScratchScanUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(scratchPackContract.receive)
  receive(@CurrentUser() user: RequestUser) {
    return async ({
      body,
    }: {
      body: Omit<ReceiveScratchPackInput, "requesterId" | "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.receiveScratchPackUseCase.execute({
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
  @TsRestHandler(scratchPackContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetScratchPacksInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getScratchPacksUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(scratchPackContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getScratchPackByIdUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        packId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(scratchPackContract.move)
  move(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: { location: "DISPLAY" | "BACKSTOCK" };
    }) => {
      const result = await this.moveScratchPackUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        packId: params.id,
        location: body.location,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(scratchPackContract.returnPack)
  returnPack(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.returnScratchPackUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        packId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(scratchPackContract.scan)
  scan(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<
        RecordScratchScanInput,
        "requesterId" | "requesterRole" | "requesterShopId" | "packId"
      >;
    }) => {
      const result = await this.recordScratchScanUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        packId: params.id,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }
}

@Controller()
export class ScratchSummaryController {
  constructor(private readonly getScratchSalesSummaryUseCase: GetScratchSalesSummaryUseCase) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(scratchSummaryContract.getSummary)
  getSummary(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetScratchSalesSummaryInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getScratchSalesSummaryUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }
}

@Controller()
export class ScratchScanController {
  constructor(
    private readonly getScratchScansUseCase: GetScratchScansUseCase,
    private readonly voidScratchScanUseCase: VoidScratchScanUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(scratchScanContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: Pick<GetScratchScansInput, "shopId" | "date"> }) => {
      const result = await this.getScratchScansUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(scratchScanContract.void)
  void(@CurrentUser() user: RequestUser) {
    return async ({ params, body }: { params: { id: string }; body: { voidReason: string } }) => {
      const result = await this.voidScratchScanUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        scanId: params.id,
        voidReason: body.voidReason,
      });
      return { status: 200 as const, body: result };
    };
  }
}
