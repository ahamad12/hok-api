// modules/auth/use-cases/update-user-profile.use-case.ts — was missing, added
import { Injectable } from "@nestjs/common";
import { NotFoundError } from "../../../common/errors";
import { toUserProfile, type UserProfileResult } from "../mappers/user-profile.mapper";
import { UserRepository } from "../repositories/user.repository";

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
    if (!user.isActive) throw new NotFoundError("User", input.userId);

    const hasDisplayName = input.displayName !== undefined;
    const hasUsername = input.username !== undefined;
    if (!hasDisplayName && !hasUsername) return toUserProfile(user);

    const updated = await this.userRepository.update(user.id, {
      ...(hasDisplayName ? { displayName: input.displayName } : {}),
      ...(hasUsername ? { username: input.username } : {}),
    });

    return toUserProfile(updated);
  }
}
