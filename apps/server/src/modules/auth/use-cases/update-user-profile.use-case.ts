// modules/auth/use-cases/update-user-profile.use-case.ts — was missing, added
import { Injectable } from "@nestjs/common";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { toUserProfile, type UserProfileResult } from "../mappers/user-profile.mapper";
import type { UserRepository } from "../repositories/user.repository";

export interface UpdateUserProfileInput {
  userId: string;
  displayName?: string;
  username?: string | null;
}

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<UserProfileResult> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new NotFoundError("User", input.userId);

    if (
      input.username !== undefined &&
      input.username !== null &&
      input.username !== user.username &&
      (await this.userRepository.existsByUsername(input.username))
    ) {
      throw new ConflictError("A user with this username already exists");
    }

    const updated = await this.userRepository.update(user.id, {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.username !== undefined ? { username: input.username } : {}),
    });

    return toUserProfile(updated);
  }
}
