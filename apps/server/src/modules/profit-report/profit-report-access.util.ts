import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../common/domain/shop-access";
import { AuthorizationError } from "../../common/errors";
import type { RequestUser } from "../../common/types/request-user.interface";

// Every profit-report use-case needs the same two checks: STAFF must be a
// supervisor, and STAFF is confined to their own shop. OWNER/MANAGER pass
// both unconditionally. ShopAccessGuard (app.module.ts:134) can't cover
// this module — it only reads request.params[paramKey], and these routes
// carry shopId via body/query, not a path param — so this stays a
// use-case-level check. Centralized here instead of re-implemented five
// times.
export function assertProfitReportAccess(requester: RequestUser, shopId: string): void {
  const isAuthorized = requester.role !== UserRole.STAFF || requester.isSupervisor;
  if (!isAuthorized) {
    throw new AuthorizationError("Only a supervisor, manager, or owner can access P&L reports");
  }
  if (!canAccessShop(requester, shopId)) {
    throw new AuthorizationError("Cannot access a report outside your shop");
  }
}
