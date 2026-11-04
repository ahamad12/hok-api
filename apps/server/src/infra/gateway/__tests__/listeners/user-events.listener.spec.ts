import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserEventsListener } from "../../listeners/user-events.listener";

describe("UserEventsListener", () => {
  let gateway: { emitToUser: ReturnType<typeof vi.fn> };
  let listener: UserEventsListener;

  beforeEach(() => {
    gateway = { emitToUser: vi.fn() };
    listener = new UserEventsListener(gateway as any);
  });

  describe("handlePasswordChanged", () => {
    it("emits SESSION_REVOKED to the user with a descriptive message", () => {
      listener.handlePasswordChanged({ userId: "user-1" });
      expect(gateway.emitToUser).toHaveBeenCalledWith("user-1", SOCKET_EVENTS.SESSION_REVOKED, {
        message: "Your session was ended because your password was changed.",
        reason: "PASSWORD_CHANGED",
      });
    });
  });

  describe("handleSessionsRevoked", () => {
    it("tells devices which sessions ended, so the others stay signed in", () => {
      listener.handleSessionsRevoked({
        userId: "user-1",
        sessionIds: ["11111111-1111-4111-8111-111111111111"],
        reason: "SESSION_REVOKED",
      });
      expect(gateway.emitToUser).toHaveBeenCalledWith("user-1", SOCKET_EVENTS.SESSION_REVOKED, {
        message: "This device was signed out from another device.",
        reason: "SESSION_REVOKED",
        sessionIds: ["11111111-1111-4111-8111-111111111111"],
      });
    });

    it("omits sessionIds when every session ended", () => {
      listener.handleSessionsRevoked({ userId: "user-1", reason: "LOGOUT_ALL" });
      expect(gateway.emitToUser).toHaveBeenCalledWith("user-1", SOCKET_EVENTS.SESSION_REVOKED, {
        message: "You have been signed out from all devices.",
        reason: "LOGOUT_ALL",
      });
    });
  });
});
