// common/types/request-user.interface.ts
import type { AccessTokenPayload } from "../schemas/jwt-payload.schema.ts";

export type RequestUser = Omit<AccessTokenPayload, "tokenVersion" | "sid" | "tid"> & {
  /** Current session id (the access token's `sid`), when present. */
  sessionId?: string;
  /** The OWNER whose business this user belongs to (their own id for an
   *  OWNER). Null/undefined = no tenant: no shop access. */
  tenantId?: string | null;
  /** OWNER/MANAGER only: the tenant's shop ids, resolved per request. */
  tenantShopIds?: readonly string[];
};
