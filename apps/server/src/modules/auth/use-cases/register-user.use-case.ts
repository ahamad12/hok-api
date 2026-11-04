// modules/auth/use-cases/register-user.use-case.ts
//
// Public sign-up: always creates an OWNER, i.e. a new business (tenant).
// MANAGER/STAFF accounts are created only by accepting an invitation
// (modules/invitation), so nobody can self-assign a role inside someone
// else's business.
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { assertValidUserRoleAssignment } from "../../../common/domain/user-role-invariants";
import { ERROR_REASONS, FieldValidationError } from "../../../common/errors";
import { toAccessTokenPayload } from "../mappers/access-token-payload.mapper";
import type { SessionMetadata } from "../repositories/refresh-token.repository";
import { UserRepository } from "../repositories/user.repository";
import { PasswordHasherService } from "../services/password-hasher.service";
import { TokenService } from "../services/token.service";

export interface RegisterUserInput {
  email: string;
  password: string;
  displayName: string;
  username?: string | null;
  deviceName?: string;
  /** Accepted only so older clients get a clear error; must be OWNER. */
  role?: UserRole;
  shopId?: string | null;
  isSupervisor?: boolean;
}

export interface RegisterUserResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    username: string | null;
    role: UserRole;
    shopId: string | null;
    isSupervisor: boolean;
  };
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    input: RegisterUserInput,
    client: Omit<SessionMetadata, "deviceName"> = {},
  ): Promise<RegisterUserResult> {
    // The contract already rejects these; repeated for direct callers.
    if (input.role && input.role !== UserRole.OWNER) {
      throw new FieldValidationError(
        [
          {
            field: "body.role",
            code: "invalid",
            message: "Managers and staff join a business by invitation",
          },
        ],
        undefined,
        ERROR_REASONS.INVITE_INVALID,
      );
    }
    assertValidUserRoleAssignment({
      role: UserRole.OWNER,
      shopId: input.shopId ?? null,
      isSupervisor: input.isSupervisor ?? false,
      ownerId: null,
    });

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.userRepository.create({
      email: input.email,
      username: input.username ?? null,
      passwordHash,
      displayName: input.displayName,
      role: UserRole.OWNER,
      isSupervisor: false,
      // shopId/ownerId stay unset (NULL): an OWNER has neither.
      lastLoginAt: new Date(),
    });

    const { sessionId, refreshToken } = await this.tokenService.issueSession(user.id, {
      ...client,
      deviceName: input.deviceName ?? null,
    });
    const accessToken = this.tokenService.generateAccessToken(
      toAccessTokenPayload(user, sessionId),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        role: user.role,
        shopId: user.shopId,
        isSupervisor: user.isSupervisor,
      },
      accessToken,
      refreshToken,
      sessionId,
    };
  }
}
