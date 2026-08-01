import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { GatewayModule } from "../../infra/gateway/gateway.module";
import { AuthModule } from "../auth/auth.module";
import { ShopModule } from "../shop/shop.module";
import { LicenseController } from "./license.controller";
import { LicenseReminderProcessor } from "./queue/license-reminder.processor";
import { LicenseReminderProducer } from "./queue/license-reminder.producer";
import { LicenseRepository } from "./repositories/license.repository";
import { LicenseRenewalRepository } from "./repositories/license-renewal.repository";
import { CreateLicenseUseCase } from "./use-cases/create-license.use-case";
import { GetExpiringLicensesUseCase } from "./use-cases/get-expiring-licenses.use-case";
import { GetLicenseByIdUseCase } from "./use-cases/get-license-by-id.use-case";
import { GetLicenseRenewalHistoryUseCase } from "./use-cases/get-license-renewal-history.use-case";
import { GetLicensesUseCase } from "./use-cases/get-licenses.use-case";
import { RenewLicenseUseCase } from "./use-cases/renew-license.use-case";
import { UpdateLicenseUseCase } from "./use-cases/update-license.use-case";
import { VoidLicenseRenewalUseCase } from "./use-cases/void-license-renewal.use-case";

@Module({
  imports: [
    ShopModule,
    AuthModule, // B3 — LicenseReminderProcessor needs UserRepository to resolve the owner's email
    GatewayModule, // B2 — LicenseReminderProcessor needs AppGateway; wasn't imported before, would have failed DI at boot
    BullModule.registerQueue({ name: "license" }),
  ],
  controllers: [LicenseController],
  providers: [
    LicenseRepository,
    LicenseRenewalRepository,
    CreateLicenseUseCase,
    GetLicensesUseCase,
    GetLicenseByIdUseCase,
    UpdateLicenseUseCase,
    RenewLicenseUseCase,
    VoidLicenseRenewalUseCase,
    GetExpiringLicensesUseCase,
    GetLicenseRenewalHistoryUseCase,
    LicenseReminderProducer,
    LicenseReminderProcessor,
  ],
  exports: [LicenseRepository, LicenseRenewalRepository],
})
export class LicenseModule {}
