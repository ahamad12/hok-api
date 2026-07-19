// modules/auth/use-cases/register-user.use-case.ts — unchanged
import { Injectable } from "@nestjs/common";
import type { PrismaService, UserRole } from "@tapt-api/db";
import { assertValidUserRoleAssignment } from "../../../common/domain/user-role-invariants";
import { ConflictError, NotFoundError } from "../../../common/errors";
import type { UserRepository } from "../repositories/user.repository";
import type { PasswordHasherService } from "../services/password-hasher.service";

export interface RegisterUserInput {
  email: string;
  password: string;
  displayName: string;
  username?: string | null;
  role: UserRole;
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
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly prisma: PrismaService, // shop-existence check; see note below
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    if (await this.userRepository.existsByEmail(input.email)) {
      throw new ConflictError("A user with this email already exists");
    }
    if (input.username && (await this.userRepository.existsByUsername(input.username))) {
      throw new ConflictError("A user with this username already exists");
    }

    const isSupervisor = input.isSupervisor ?? false;
    const shopId = input.shopId ?? null;
    assertValidUserRoleAssignment({ role: input.role, shopId, isSupervisor });

    if (shopId) {
      const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new NotFoundError("Shop", shopId);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.userRepository.create({
      email: input.email,
      username: input.username ?? null,
      passwordHash,
      displayName: input.displayName,
      role: input.role,
      shopId,
      isSupervisor,
    });

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
    };
  }
}
