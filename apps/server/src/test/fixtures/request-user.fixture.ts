import { UserRole } from "@tapt-api/db";
import type { RequestUser } from "../../common/types/request-user.interface";

/**
 * Every shop id the unit tests use belongs to the test owner's tenant, so
 * OWNER/MANAGER requesters can reach them. Cross-tenant behaviour is tested
 * explicitly with FOREIGN_SHOP_ID, which is never in this list.
 */
export const TEST_TENANT_ID = "owner-1";
export const TEST_TENANT_SHOP_IDS: readonly string[] = [
  "shop-1",
  "shop-2",
  "other-shop",
  "some-other-shop",
  "shop-42",
  "shop-999",
];
export const FOREIGN_SHOP_ID = "foreign-tenant-shop";

export function buildRequestUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    userId: "user-staff-1",
    email: "staff@shop.test",
    role: UserRole.STAFF,
    shopId: "shop-1",
    isSupervisor: false,
    tenantId: TEST_TENANT_ID,
    tenantShopIds: TEST_TENANT_SHOP_IDS,
    ...overrides,
  };
}
