// In-process (EventEmitter2) auth events. Dependency-free so listeners in
// infra/ can import them without pulling in auth services.
import type { RefreshTokenRevokeReason } from "@tapt-api/db";

/** UserEventsListener turns this into a SESSION_REVOKED socket push. */
export const SESSIONS_REVOKED_EVENT = "user.sessions_revoked";

export interface SessionsRevokedEvent {
  userId: string;
  /** Ended sessions; omitted when every session of the user ended. */
  sessionIds?: string[];
  reason: RefreshTokenRevokeReason;
}
