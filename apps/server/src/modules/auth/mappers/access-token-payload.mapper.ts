import type { User } from "@tapt-api/db";
import { tenantIdOf } from "../../../common/domain/tenant";
import type { AccessTokenPayload } from "../../../common/schemas/jwt-payload.schema";

/** The one place a User becomes access-token claims. */
export function toAccessTokenPayload(user: User, sessionId: string): AccessTokenPayload {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    shopId: user.shopId,
    isSupervisor: user.isSupervisor,
    tokenVersion: user.tokenVersion,
    sid: sessionId,
    tid: tenantIdOf(user),
  };
}
