// common/types/request-user.interface.ts
import type { AccessTokenPayload } from "../schemas/jwt-payload.schema.ts";

export type RequestUser = Omit<AccessTokenPayload, "tokenVersion" | "sid"> & {
  /** Current session id (the access token's `sid`), when present. */
  sessionId?: string;
};
