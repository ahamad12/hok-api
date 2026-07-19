// modules/auth/mappers/user-profile.mapper.ts — unchanged, this was already correct
import type { User } from "@tapt-api/db";

export type UserProfileResult = Pick<
  User,
  | "id"
  | "email"
  | "displayName"
  | "username"
  | "role"
  | "shopId"
  | "isSupervisor"
  | "isActive"
  | "lastLoginAt"
  | "createdAt"
  | "updatedAt"
>;

export function toUserProfile(user: User): UserProfileResult {
  const {
    id,
    email,
    displayName,
    username,
    role,
    shopId,
    isSupervisor,
    isActive,
    lastLoginAt,
    createdAt,
    updatedAt,
  } = user;
  return {
    id,
    email,
    displayName,
    username,
    role,
    shopId,
    isSupervisor,
    isActive,
    lastLoginAt,
    createdAt,
    updatedAt,
  };
}
