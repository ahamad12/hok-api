import { UserRole } from "@tapt-api/db";
import { Roles } from "./roles.decorator";

export const OwnerOnly = () => Roles(UserRole.OWNER);
export const OwnerOrManager = () => Roles(UserRole.OWNER, UserRole.MANAGER);
export const SupervisorOrAbove = () => Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF);
