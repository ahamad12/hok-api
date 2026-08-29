import { Module } from "@nestjs/common";
import { GatewayModule } from "../../infra/gateway/gateway.module";
import { ShopModule } from "../shop/shop.module";
import { FormController } from "./form.controller";
import { FormEventsListener } from "./listeners/form-events.listener";
import { FormRepository } from "./repositories/form.repository";
import { FormSubmissionRepository } from "./repositories/form-submission.repository";
import { CreateFormUseCase } from "./use-cases/create-form.use-case";
import { GetFormByIdUseCase } from "./use-cases/get-form-by-id.use-case";
import { GetFormsUseCase } from "./use-cases/get-forms.use-case";
import { GetSubmissionsUseCase } from "./use-cases/get-submissions.use-case";
import { SubmitFormUseCase } from "./use-cases/submit-form.use-case";
import { UpdateFormUseCase } from "./use-cases/update-form.use-case";

@Module({
  // No AuthModule — nothing here depends on UserRepository (unlike
  // TicketModule's forwardRef(AuthModule) for assigneeId). ShopModule is
  // for CreateFormUseCase's shop.isActive check; GatewayModule for
  // FormEventsListener.
  imports: [ShopModule, GatewayModule],
  controllers: [FormController],
  providers: [
    FormRepository,
    FormSubmissionRepository,
    CreateFormUseCase,
    GetFormsUseCase,
    GetFormByIdUseCase,
    UpdateFormUseCase,
    SubmitFormUseCase,
    GetSubmissionsUseCase,
    FormEventsListener,
  ],
})
export class FormModule {}
