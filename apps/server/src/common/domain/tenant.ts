// common/domain/tenant.ts — who owns which business.
import { UserRole } from "@tapt-api/db";

/** An OWNER is their own tenant; MANAGER/STAFF belong to their owner.
 *  Null = a MANAGER/STAFF with no tenant (fails closed everywhere). */
export function tenantIdOf(user: {
  id: string;
  role: UserRole;
  ownerId: string | null;
}): string | null {
  return user.role === UserRole.OWNER ? user.id : user.ownerId;
}
