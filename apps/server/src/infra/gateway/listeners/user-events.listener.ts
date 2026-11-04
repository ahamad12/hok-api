import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import {
  SESSIONS_REVOKED_EVENT,
  type SessionsRevokedEvent,
} from "../../../modules/auth/auth.events";
import { AppGateway } from "../app.gateway";

const REVOKED_MESSAGES: Record<SessionsRevokedEvent["reason"], string> = {
  ROTATED: "Your session has ended.",
  LOGOUT: "You have been signed out.",
  LOGOUT_ALL: "You have been signed out from all devices.",
  SESSION_REVOKED: "This device was signed out from another device.",
  REUSE_DETECTED: "Your session was ended because your sign-in may have been compromised.",
  PASSWORD_CHANGED: "Your session was ended because your password was changed.",
};

@Injectable()
export class UserEventsListener {
  constructor(private readonly gateway: AppGateway) {}

  @OnEvent("user.password_changed")
  handlePasswordChanged(payload: { userId: string }) {
    this.gateway.emitToUser(payload.userId, SOCKET_EVENTS.SESSION_REVOKED, {
      message: REVOKED_MESSAGES.PASSWORD_CHANGED,
      reason: "PASSWORD_CHANGED",
    });
  }

  @OnEvent(SESSIONS_REVOKED_EVENT)
  handleSessionsRevoked(payload: SessionsRevokedEvent) {
    this.gateway.emitToUser(payload.userId, SOCKET_EVENTS.SESSION_REVOKED, {
      message: REVOKED_MESSAGES[payload.reason],
      reason: payload.reason,
      ...(payload.sessionIds ? { sessionIds: payload.sessionIds } : {}),
    });
  }
}
