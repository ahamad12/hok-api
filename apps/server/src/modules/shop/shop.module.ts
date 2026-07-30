import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module"; // for UserRepository, TokenVersionService
import { ShopRepository } from "./repositories/shop.repository";
import { ShopController } from "./shop.controller";
import { AssignStaffUseCase } from "./use-cases/assign-staff.use-case";
import { CreateShopUseCase } from "./use-cases/create-shop.use-case";
import { DeleteShopUseCase } from "./use-cases/delete-shop.use-case";
import { GetMyShopsUseCase } from "./use-cases/get-my-shops.use-case";
import { GetShopByIdUseCase } from "./use-cases/get-shop-by-id.use-case";
import { GetShopStaffUseCase } from "./use-cases/get-shop-staff.use-case";
import { RemoveStaffUseCase } from "./use-cases/remove-staff.use-case";
import { UpdateShopUseCase } from "./use-cases/update-shop.use-case";

@Module({
  imports: [AuthModule],
  controllers: [ShopController],
  providers: [
    ShopRepository,
    CreateShopUseCase,
    GetShopByIdUseCase,
    GetMyShopsUseCase,
    UpdateShopUseCase,
    DeleteShopUseCase,
    GetShopStaffUseCase,
    AssignStaffUseCase,
    RemoveStaffUseCase,
  ],
  exports: [ShopRepository],
})
export class ShopModule {}
