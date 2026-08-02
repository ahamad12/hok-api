// modules/auth/use-cases/register-user.use-case.ts — unchanged
import { Injectable } from "@nestjs/common";
import { PrismaService, type UserRole } from "@tapt-api/db";
import { Prisma } from "@tapt-api/db/prisma";
import { assertValidUserRoleAssignment } from "../../../common/domain/user-role-invariants";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { UserRepository } from "../repositories/user.repository";
import { PasswordHasherService } from "../services/password-hasher.service";

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
    const isSupervisor = input.isSupervisor ?? false;
    const shopId = input.shopId ?? null;
    assertValidUserRoleAssignment({ role: input.role, shopId, isSupervisor });

    if (shopId) {
      const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new NotFoundError("Shop", shopId);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    try {
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = error.meta?.target;
        const message =
          Array.isArray(target) && target.includes("username")
            ? "A user with this username already exists"
            : "A user with this email already exists";
        throw new ConflictError(message);
      }
      throw error;
    }
  }
}
