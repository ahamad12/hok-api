import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ShopModule } from "../shop/shop.module";
import { InvitationController } from "./invitation.controller";
import { InvitationRepository } from "./repositories/invitation.repository";
import { AcceptInvitationUseCase } from "./use-cases/accept-invitation.use-case";
import { CreateInvitationUseCase } from "./use-cases/create-invitation.use-case";
import {
  GetInvitationsUseCase,
  ResendInvitationUseCase,
  RevokeInvitationUseCase,
} from "./use-cases/manage-invitations.use-case";

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => ShopModule)],
  controllers: [InvitationController],
  providers: [
    InvitationRepository,
    CreateInvitationUseCase,
    GetInvitationsUseCase,
    RevokeInvitationUseCase,
    ResendInvitationUseCase,
    AcceptInvitationUseCase,
  ],
})
export class InvitationModule {}
