// modules/supplier/supplier.module.ts
import { Module } from "@nestjs/common";
import { CategoryModule } from "../category/category.module";
import { ShopModule } from "../shop/shop.module";
import { SupplierRepository } from "./repositories/supplier.repository";
import { SupplierController } from "./supplier.controller";
import { CreateSupplierUseCase } from "./use-cases/create-supplier.use-case";
import { GetSupplierByIdUseCase } from "./use-cases/get-supplier-by-id.use-case";
import { GetSuppliersUseCase } from "./use-cases/get-suppliers.use-case";
import { UpdateSupplierUseCase } from "./use-cases/update-supplier.use-case";

@Module({
  imports: [ShopModule, CategoryModule],
  controllers: [SupplierController],
  providers: [
    SupplierRepository,
    CreateSupplierUseCase,
    GetSuppliersUseCase,
    GetSupplierByIdUseCase,
    UpdateSupplierUseCase,
  ],
  exports: [SupplierRepository],
})
export class SupplierModule {}
