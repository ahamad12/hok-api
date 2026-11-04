import { UserRole } from "@tapt-api/db";
import { Roles } from "./roles.decorator";

export const OwnerOnly = () => Roles(UserRole.OWNER);
export const OwnerOrManager = () => Roles(UserRole.OWNER, UserRole.MANAGER);
/**
 * @deprecated Misleading name — this passes ANY authenticated role
 * (OWNER, MANAGER, even non-supervisor STAFF). It is NOT a supervisor
 * check. For supervisor-gated routes use RequireSupervisorOrAbove()
 * from roles.decorator.ts instead. Kept for backward compat; do not use
 * in new code.
 */
export const SupervisorOrAbove = () => Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF);
