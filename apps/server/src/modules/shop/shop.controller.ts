import { Controller } from "@nestjs/common";
import { shopContract } from "@tapt-api/api/contracts/shop.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles, ShopAccess } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AssignStaffUseCase } from "./use-cases/assign-staff.use-case";
import { type CreateShopInput, CreateShopUseCase } from "./use-cases/create-shop.use-case";
import { DeleteShopUseCase } from "./use-cases/delete-shop.use-case";
import { GetMyShopsUseCase } from "./use-cases/get-my-shops.use-case";
import { GetShopByIdUseCase } from "./use-cases/get-shop-by-id.use-case";
import { GetShopStaffUseCase } from "./use-cases/get-shop-staff.use-case";
import { RemoveStaffUseCase } from "./use-cases/remove-staff.use-case";
import { type UpdateShopInput, UpdateShopUseCase } from "./use-cases/update-shop.use-case";

// Same tsRestHandler() convention issue as auth.controller.ts — see that
// file's comment. Typing handlers against use-case Input/Result interfaces
// directly rather than ServerInferRequest/Responses, which collapse to
// `never` on this package's @ts-rest/core version.
@Controller()
export class ShopController {
  constructor(
    private readonly createShopUseCase: CreateShopUseCase,
    private readonly getShopByIdUseCase: GetShopByIdUseCase,
    private readonly getMyShopsUseCase: GetMyShopsUseCase,
    private readonly updateShopUseCase: UpdateShopUseCase,
    private readonly deleteShopUseCase: DeleteShopUseCase,
    private readonly getShopStaffUseCase: GetShopStaffUseCase,
    private readonly assignStaffUseCase: AssignStaffUseCase,
    private readonly removeStaffUseCase: RemoveStaffUseCase,
  ) {}

  @Roles(UserRole.OWNER)
  @TsRestHandler(shopContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: Omit<CreateShopInput, "requesterId"> }) => {
      const result = await this.createShopUseCase.execute({ requesterId: user.userId, ...body });
      return { status: 201 as const, body: result.shop };
    };
  }

  @ShopAccess("id") // OWNER/MANAGER bypass built into the guard; STAFF must match their own shopId
  @TsRestHandler(shopContract.getById)
  getById() {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getShopByIdUseCase.execute({ shopId: params.id });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER)
  @TsRestHandler(shopContract.getMyShops)
  getMyShops(@CurrentUser() user: RequestUser) {
    return async () => {
      const result = await this.getMyShopsUseCase.execute({ requesterId: user.userId });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER)
  @TsRestHandler(shopContract.update)
  update(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<UpdateShopInput, "requesterId" | "shopId">;
    }) => {
      const result = await this.updateShopUseCase.execute({
        requesterId: user.userId,
        shopId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER)
  @TsRestHandler(shopContract.delete)
  delete(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.deleteShopUseCase.execute({
        requesterId: user.userId,
        shopId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ShopAccess("id")
  @TsRestHandler(shopContract.getStaff)
  getStaff() {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getShopStaffUseCase.execute({ shopId: params.id });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(shopContract.assignStaff)
  assignStaff(@CurrentUser() user: RequestUser) {
    return async ({ params, body }: { params: { id: string }; body: { userId: string } }) => {
      const result = await this.assignStaffUseCase.execute({
        requesterId: user.userId,
        shopId: params.id,
        userId: body.userId,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(shopContract.removeStaff)
  removeStaff(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string; userId: string } }) => {
      const result = await this.removeStaffUseCase.execute({
        requesterId: user.userId,
        shopId: params.id,
        userId: params.userId,
      });
      return { status: 200 as const, body: result };
    };
  }
}
