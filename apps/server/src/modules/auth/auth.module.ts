// modules/auth/auth.module.ts — fixed: JwtAuthGuard registered here (no cycle),
// RedisModule imported, TokenVersionService wired
import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { env } from "@tapt-api/env/server";
import { AccessTokenVerifierService } from "../../common/auth/access-token-verifier.service";
import { RedisModule } from "../../common/redis/redis.module";
import { ShopModule } from "../shop/shop.module";
import { AuthController } from "./auth.controller";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { UserRepository } from "./repositories/user.repository";
import { PasswordHasherService } from "./services/password-hasher.service";
import { TokenService } from "./services/token.service";
import { TokenVersionService } from "./services/token-version.service";
import { ChangePasswordUseCase } from "./use-cases/change-password.use-case";
import { GetUserProfileUseCase } from "./use-cases/get-user-profile.use-case";
import { LoginUseCase } from "./use-cases/login.use-case";
import { LogoutUseCase } from "./use-cases/logout.use-case";
import { RefreshTokenUseCase } from "./use-cases/refresh-token.use-case";
import { RegisterUserUseCase } from "./use-cases/register-user.use-case";
import { UpdateUserProfileUseCase } from "./use-cases/update-user-profile.use-case";

@Module({
  imports: [
    RedisModule,
    forwardRef(() => ShopModule),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: env.JWT_SECRET,
        signOptions: {
          expiresIn: env.JWT_ACCESS_EXPIRY,
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
    ChangePasswordUseCase,
    GetUserProfileUseCase,
    UpdateUserProfileUseCase,
    AccessTokenVerifierService,
  ],
  exports: [TokenService, UserRepository, TokenVersionService, AccessTokenVerifierService],
})
export class AuthModule {}
