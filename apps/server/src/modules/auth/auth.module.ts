// modules/auth/auth.module.ts — fixed: JwtAuthGuard registered here (no cycle),
// RedisModule imported, TokenVersionService wired
import { BullModule } from "@nestjs/bullmq";
import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { env } from "@tapt-api/env/server";
import { AccessTokenVerifierService } from "../../common/auth/access-token-verifier.service";
import { RedisModule } from "../../common/redis/redis.module";
import { ShopModule } from "../shop/shop.module";
import { AuthController } from "./auth.controller";
import { AUTH_MAINTENANCE_QUEUE } from "./queue/auth-maintenance.constants";
import { AuthMaintenanceProcessor } from "./queue/auth-maintenance.processor";
import { AuthMaintenanceProducer } from "./queue/auth-maintenance.producer";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { UserRepository } from "./repositories/user.repository";
import { PasswordHasherService } from "./services/password-hasher.service";
import { TokenService } from "./services/token.service";
import { TokenVersionService } from "./services/token-version.service";
import { ChangePasswordUseCase } from "./use-cases/change-password.use-case";
import { GetSessionsUseCase } from "./use-cases/get-sessions.use-case";
import { GetUserProfileUseCase } from "./use-cases/get-user-profile.use-case";
import { LoginUseCase } from "./use-cases/login.use-case";
import { LogoutUseCase } from "./use-cases/logout.use-case";
import { LogoutAllUseCase } from "./use-cases/logout-all.use-case";
import { RefreshTokenUseCase } from "./use-cases/refresh-token.use-case";
import { RegisterUserUseCase } from "./use-cases/register-user.use-case";
import { RevokeSessionUseCase } from "./use-cases/revoke-session.use-case";
import { UpdateUserProfileUseCase } from "./use-cases/update-user-profile.use-case";

@Module({
  imports: [
    RedisModule,
    BullModule.registerQueue({ name: AUTH_MAINTENANCE_QUEUE }),
    forwardRef(() => ShopModule),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: env.JWT_SECRET,
        signOptions: {
          algorithm: "HS256",
          expiresIn: env.JWT_ACCESS_EXPIRY,
          issuer: "tapt-api",
          audience: "tapt-mobile",
        },
        // Without these, verify() accepts any issuer/audience signed with
        // the same secret, and doesn't pin the algorithm.
        verifyOptions: {
          algorithms: ["HS256"],
          issuer: "tapt-api",
          audience: "tapt-mobile",
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    UserRepository,
    RefreshTokenRepository,
    PasswordHasherService,
    TokenService,
    TokenVersionService,
    RegisterUserUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    GetSessionsUseCase,
    RevokeSessionUseCase,
    AuthMaintenanceProducer,
    AuthMaintenanceProcessor,
    ChangePasswordUseCase,
    GetUserProfileUseCase,
    UpdateUserProfileUseCase,
    AccessTokenVerifierService,
  ],
  exports: [TokenService, UserRepository, TokenVersionService, AccessTokenVerifierService],
})
export class AuthModule {}
