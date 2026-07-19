import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@tapt-api/db";

export const ROLES_KEY = "ROLES";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const SUPERVISOR_ONLY_KEY = "SUPERVISOR_ONLY";
export const RequireSupervisorOrAbove = () => SetMetadata(SUPERVISOR_ONLY_KEY, true);
