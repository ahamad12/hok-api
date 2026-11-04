import { Controller } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { invitationContract } from "@tapt-api/api/contracts/invitation.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import {
  type ClientMeta,
  CurrentClient,
  CurrentUser,
  Public,
  Roles,
} from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { InvitationStatus } from "./repositories/invitation.repository";
import {
  type AcceptInvitationInput,
  AcceptInvitationUseCase,
} from "./use-cases/accept-invitation.use-case";
import {
  type CreateInvitationInput,
  CreateInvitationUseCase,
} from "./use-cases/create-invitation.use-case";
import {
  GetInvitationsUseCase,
  ResendInvitationUseCase,
  RevokeInvitationUseCase,
} from "./use-cases/manage-invitations.use-case";

// Handlers return plain async functions typed against use-case inputs —
// see auth.controller.ts for why (ts-rest 3.52 + zod 4 inference).
@Controller()
export class InvitationController {
  constructor(
    private readonly createInvitationUseCase: CreateInvitationUseCase,
    private readonly getInvitationsUseCase: GetInvitationsUseCase,
    private readonly revokeInvitationUseCase: RevokeInvitationUseCase,
    private readonly resendInvitationUseCase: ResendInvitationUseCase,
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(invitationContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: CreateInvitationInput }) => {
      const result = await this.createInvitationUseCase.execute(user, body);
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(invitationContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: { status?: InvitationStatus; limit: number; offset: number };
    }) => {
      const result = await this.getInvitationsUseCase.execute(user, query);
      return { status: 200 as const, body: result };
    };
  }

  @Public()
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @TsRestHandler(invitationContract.accept)
  accept(@CurrentClient() client: ClientMeta) {
    return async ({ body }: { body: AcceptInvitationInput }) => {
      const result = await this.acceptInvitationUseCase.execute(body, client);
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(invitationContract.resend)
  resend(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.resendInvitationUseCase.execute(user, params.id);
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(invitationContract.revoke)
  revoke(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.revokeInvitationUseCase.execute(user, params.id);
      return { status: 200 as const, body: result };
    };
  }
}
