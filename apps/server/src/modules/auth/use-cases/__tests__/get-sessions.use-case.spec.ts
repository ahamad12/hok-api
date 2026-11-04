import { describe, expect, it, vi } from "vitest";
import { GetSessionsUseCase } from "../get-sessions.use-case";

describe("GetSessionsUseCase", () => {
  it("maps each live token to its session and flags the caller's own", async () => {
    const tokenService = {
      listActiveSessions: vi.fn().mockResolvedValue([
        {
          familyId: "sess-1",
          deviceName: "Phone",
          userAgent: "ua",
          ipAddress: "1.1.1.1",
          sessionStartedAt: new Date("2026-11-01"),
          createdAt: new Date("2026-11-03"),
          expiresAt: new Date("2026-11-10"),
        },
        {
          familyId: "sess-2",
          deviceName: null,
          userAgent: null,
          ipAddress: null,
          sessionStartedAt: new Date("2026-10-01"),
          createdAt: new Date("2026-10-02"),
          expiresAt: new Date("2026-10-09"),
        },
      ]),
    };
    const result = await new GetSessionsUseCase(tokenService as any).execute("user-1", "sess-2");

    expect(tokenService.listActiveSessions).toHaveBeenCalledWith("user-1");
    expect(result.sessions).toEqual([
      expect.objectContaining({
        id: "sess-1",
        createdAt: new Date("2026-11-01"),
        lastActiveAt: new Date("2026-11-03"),
        isCurrent: false,
      }),
      expect.objectContaining({ id: "sess-2", isCurrent: true }),
    ]);
  });
});
