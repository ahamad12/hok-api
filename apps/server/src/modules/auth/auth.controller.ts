import { Controller } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { authContract } from "@tapt-api/api/contracts/auth.contract";
import { TsRestHandler } from "@ts-rest/nest";
import { type ClientMeta, CurrentClient, CurrentUser, Public } from "../../common/decorators";
import { emailTracker } from "../../common/guards/user-throttler.guard";
import type { RequestUser } from "../../common/types/request-user.interface";
import {
  type ChangePasswordInput,
  ChangePasswordUseCase,
} from "./use-cases/change-password.use-case";
import { GetSessionsUseCase } from "./use-cases/get-sessions.use-case";
import { GetUserProfileUseCase } from "./use-cases/get-user-profile.use-case";
import { type LoginInput, LoginUseCase } from "./use-cases/login.use-case";
import { type LogoutInput, LogoutUseCase } from "./use-cases/logout.use-case";
import { LogoutAllUseCase } from "./use-cases/logout-all.use-case";
import { type RefreshTokenInput, RefreshTokenUseCase } from "./use-cases/refresh-token.use-case";
import { type RegisterUserInput, RegisterUserUseCase } from "./use-cases/register-user.use-case";
import { RevokeSessionUseCase } from "./use-cases/revoke-session.use-case";
import {
  type UpdateUserProfileInput,
  UpdateUserProfileUseCase,
} from "./use-cases/update-user-profile.use-case";

/**
 * NOT using ServerInferRequest/ServerInferResponses here — in this
 * @ts-rest/core version they collapse indexed route access
 * (typeof authContract.someRoute) to `never` rather than narrowing,
 * which cascades into "Type X is not assignable to type never" and
 * "Spread types may only be created from object types" on every handler.
 * Typing directly against each use case's own Input/Result interfaces
 * sidesteps the broken generic entirely. Runtime request/response
 * validation is unaffected — TsRestHandlerInterceptor still validates
 * against authContract's Zod schemas regardless of these TS annotations.
 */
@Controller()
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
    private readonly getSessionsUseCase: GetSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
  ) {}

  @Public()
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @TsRestHandler(authContract.register)
  register() {
    return async ({ body }: { body: RegisterUserInput }) => {
      const result = await this.registerUserUseCase.execute(body);
      return { status: 201 as const, body: result };
    };
  }

  @Public()
  @Throttle({
    auth: { limit: 20, ttl: 60000 },
    "auth-account": { limit: 10, ttl: 15 * 60000, getTracker: emailTracker },
  })
  @TsRestHandler(authContract.login)
  login(@CurrentClient() client: ClientMeta) {
    return async ({ body }: { body: LoginInput }) => {
      const result = await this.loginUseCase.execute(body, client);
      return { status: 200 as const, body: result };
    };
  }

  @Public()
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @TsRestHandler(authContract.refresh)
  refresh(@CurrentClient() client: ClientMeta) {
    return async ({ body }: { body: RefreshTokenInput }) => {
      const result = await this.refreshTokenUseCase.execute(body, client);
      return { status: 200 as const, body: result };
    };
  }

  // Public by design: revocation is idempotent and keyed by the opaque
  // refresh token in the body, so an expired access token must not block
  // logout. No user context is needed — the token identifies the session.
  @Public()
  @TsRestHandler(authContract.logout)
  logout() {
    return async ({ body }: { body: LogoutInput }) => {
      const result = await this.logoutUseCase.execute(body);
      return { status: 200 as const, body: result };
    };
  }

  @TsRestHandler(authContract.logoutAll)
  logoutAll(@CurrentUser() user: RequestUser) {
    return async () => {
      const result = await this.logoutAllUseCase.execute(user.userId);
      return { status: 200 as const, body: result };
    };
  }

  @TsRestHandler(authContract.getSessions)
  getSessions(@CurrentUser() user: RequestUser) {
    return async () => {
      const result = await this.getSessionsUseCase.execute(user.userId, user.sessionId);
      return { status: 200 as const, body: result };
    };
  }

  @TsRestHandler(authContract.revokeSession)
  revokeSession(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.revokeSessionUseCase.execute(user.userId, params.id);
      return { status: 200 as const, body: result };
    };
  }

  @TsRestHandler(authContract.getProfile)
  getProfile(@CurrentUser() user: RequestUser) {
    return async () => {
      const result = await this.getUserProfileUseCase.execute({ userId: user.userId });
      return { status: 200 as const, body: result };
    };
  }

  @TsRestHandler(authContract.updateProfile)
  updateProfile(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: Omit<UpdateUserProfileInput, "userId"> }) => {
      const result = await this.updateUserProfileUseCase.execute({ userId: user.userId, ...body });
      return { status: 200 as const, body: result };
    };
  }

  @TsRestHandler(authContract.changePassword)
  changePassword(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: Omit<ChangePasswordInput, "userId"> }) => {
      const result = await this.changePasswordUseCase.execute({ userId: user.userId, ...body });
      return { status: 200 as const, body: result };
    };
  }
}
