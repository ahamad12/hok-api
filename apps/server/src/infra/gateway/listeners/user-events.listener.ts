import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import type { AppGateway } from "../app.gateway";

@Injectable()
export class UserEventsListener {
  constructor(private readonly gateway: AppGateway) {}

  @OnEvent("user.password_changed")
  handlePasswordChanged(payload: { userId: string }) {
    this.gateway.emitToUser(payload.userId, SOCKET_EVENTS.SESSION_REVOKED, {
      message: "Your session was ended because your password was changed.",
    });
  }
}
