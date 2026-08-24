// modules/auth/use-cases/register-user.use-case.ts
import { Injectable } from "@nestjs/common";
import type { UserRole } from "@tapt-api/db";
import { assertValidUserRoleAssignment } from "../../../common/domain/user-role-invariants";
import { BusinessRuleError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
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
    private readonly shopRepository: ShopRepository,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    const isSupervisor = input.isSupervisor ?? false;
    const shopId = input.shopId ?? null;
    assertValidUserRoleAssignment({ role: input.role, shopId, isSupervisor });

    if (shopId) {
      const shop = await this.shopRepository.findById(shopId);
      if (!shop) throw new NotFoundError("Shop", shopId);
      if (!shop.isActive) throw new BusinessRuleError("Cannot assign user to deactivated shop");
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
