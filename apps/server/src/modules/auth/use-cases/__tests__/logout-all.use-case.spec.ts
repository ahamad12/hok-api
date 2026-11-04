import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSIONS_REVOKED_EVENT } from "../../auth.events";
import { LogoutAllUseCase } from "../logout-all.use-case";

describe("LogoutAllUseCase", () => {
  let tokenService: { revokeAllSessions: ReturnType<typeof vi.fn> };
  let tokenVersionService: { invalidateSessions: ReturnType<typeof vi.fn> };
  let events: { emit: ReturnType<typeof vi.fn> };
  let useCase: LogoutAllUseCase;

  beforeEach(() => {
    tokenService = { revokeAllSessions: vi.fn().mockResolvedValue(3) };
    tokenVersionService = { invalidateSessions: vi.fn().mockResolvedValue(5) };
    events = { emit: vi.fn() };
    useCase = new LogoutAllUseCase(tokenService as any, tokenVersionService as any, events as any);
  });

  it("ends every refresh session and kills live access tokens via tokenVersion", async () => {
    const result = await useCase.execute("user-1");
    expect(tokenService.revokeAllSessions).toHaveBeenCalledWith("user-1", "LOGOUT_ALL");
    expect(tokenVersionService.invalidateSessions).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ message: "Signed out from all devices", sessionsRevoked: 3 });
  });

  it("notifies connected devices with no sessionIds (= all sessions)", async () => {
    await useCase.execute("user-1");
    expect(events.emit).toHaveBeenCalledWith(SESSIONS_REVOKED_EVENT, {
      userId: "user-1",
      reason: "LOGOUT_ALL",
    });
  });
});
