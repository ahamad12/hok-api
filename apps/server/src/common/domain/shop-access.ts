// common/domain/shop-access.ts — the one rule for "may this user touch this shop?"
import { UserRole } from "@tapt-api/db";

/** The parts of a requester that decide shop access. RequestUser fits it. */
export interface ShopScope {
  role: UserRole;
  /** STAFF: their own shop. Null for OWNER/MANAGER. */
  shopId: string | null;
  /** OWNER/MANAGER: every shop in their tenant (resolved per request). */
  tenantShopIds?: readonly string[];
}

/**
 * STAFF may access only their own shop. OWNER and MANAGER may access any
 * shop of their tenant, and no other. Fails closed: an OWNER/MANAGER whose
 * tenant shops were not resolved gets no access.
 */
export function canAccessShop(scope: ShopScope, shopId: string): boolean {
  if (scope.role === UserRole.STAFF) return scope.shopId === shopId;
  return scope.tenantShopIds?.includes(shopId) ?? false;
}

/** Adapter for use-cases that take flattened requester fields. */
export function requesterScope(input: {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
}): ShopScope {
  return {
    role: input.requesterRole,
    shopId: input.requesterShopId,
    tenantShopIds: input.requesterTenantShopIds,
  };
}
