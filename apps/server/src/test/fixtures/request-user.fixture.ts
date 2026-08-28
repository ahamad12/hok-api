import { UserRole } from "@tapt-api/db";
import type { RequestUser } from "../../common/types/request-user.interface";

export function buildRequestUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    userId: "user-staff-1",
    email: "staff@shop.test",
    role: UserRole.STAFF,
    shopId: "shop-1",
    isSupervisor: false,
    ...overrides,
  };
}
