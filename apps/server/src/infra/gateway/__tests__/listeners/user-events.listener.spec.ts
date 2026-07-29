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
      });
    });
  });
});
