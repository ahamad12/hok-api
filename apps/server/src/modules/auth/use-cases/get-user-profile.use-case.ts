// modules/auth/use-cases/get-user-profile.use-case.ts — unchanged
import { Injectable } from "@nestjs/common";
import { NotFoundError } from "../../../common/errors";
import { toUserProfile, type UserProfileResult } from "../mappers/user-profile.mapper";
import { UserRepository } from "../repositories/user.repository";

export interface GetUserProfileInput {
  userId: string;
}

@Injectable()
export class GetUserProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: GetUserProfileInput): Promise<UserProfileResult> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new NotFoundError("User", input.userId);
    if (!user.isActive) throw new NotFoundError("User", input.userId);
    return toUserProfile(user);
  }
}
