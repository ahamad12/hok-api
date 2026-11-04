import { env } from "@tapt-api/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "../../../../common/crypto/hash-token";
import { AuthenticationError, ERROR_REASONS } from "../../../../common/errors";
import { createRedisClientMock, type RedisClientMock } from "../../../../test/redis-client-mock";
import { SESSIONS_REVOKED_EVENT } from "../../auth.events";
import { TokenService } from "../token.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-04T10:00:00.000Z");

describe("TokenService", () => {
  let repo: Record<
    | "create"
    | "rotate"
    | "findByToken"
    | "revokeFamily"
    | "revokeUserFamily"
    | "revokeAllForUser"
    | "findActiveForUser"
    | "deleteExpiredBefore",
    ReturnType<typeof vi.fn>
  >;
  let redis: RedisClientMock;
  let events: { emit: ReturnType<typeof vi.fn> };
  let service: TokenService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    repo = {
      create: vi.fn().mockResolvedValue({}),
      rotate: vi.fn(),
      findByToken: vi.fn(),
      revokeFamily: vi.fn().mockResolvedValue(1),
      revokeUserFamily: vi.fn(),
      revokeAllForUser: vi.fn(),
      findActiveForUser: vi.fn(),
      deleteExpiredBefore: vi.fn(),
    };
    redis = createRedisClientMock();
    events = { emit: vi.fn() };
    service = new TokenService(
      { sign: vi.fn().mockReturnValue("jwt") } as any,
      repo as any,
      redis as any,
      events as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("issueSession", () => {
    it("starts a new family, stores only the hash, and returns the raw token once", async () => {
      const { sessionId, refreshToken } = await service.issueSession("user-1", {
        deviceName: "Phone",
      });

      expect(refreshToken).toMatch(/^[0-9a-f]{64}$/);
      const stored = repo.create.mock.calls[0]?.[0];
      expect(stored).toMatchObject({
        userId: "user-1",
        familyId: sessionId,
        token: hashToken(refreshToken),
        sessionStartedAt: NOW,
        deviceName: "Phone",
      });
      expect(stored.token).not.toBe(refreshToken);
      expect(stored.expiresAt.getTime()).toBe(NOW.getTime() + env.JWT_REFRESH_EXPIRY_DAYS * DAY_MS);
    });
  });

  describe("rotate", () => {
    it("returns the child token on success", async () => {
      repo.rotate.mockResolvedValue({
        status: "rotated",
        previous: {},
        next: { userId: "user-1", familyId: "fam-1" },
      });
      const result = await service.rotate("raw");
      expect(repo.rotate).toHaveBeenCalledWith(hashToken("raw"), NOW, expect.any(Function));
      expect(result).toMatchObject({ userId: "user-1", sessionId: "fam-1" });
      expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it("caps the child's expiry at the session's absolute lifetime", async () => {
      repo.rotate.mockResolvedValue({
        status: "rotated",
        previous: {},
        next: { userId: "u", familyId: "f" },
      });
      await service.rotate("raw");
      const buildNext = repo.rotate.mock.calls[0]?.[2];

      // Session started (max - 1) days ago → only 1 day left, less than the sliding TTL.
      const startedAt = new Date(NOW.getTime() - (env.JWT_SESSION_MAX_DAYS - 1) * DAY_MS);
      const next = buildNext({ sessionStartedAt: startedAt });
      expect(next.expiresAt.getTime()).toBe(NOW.getTime() + DAY_MS);

      // Fresh session → normal sliding TTL.
      const fresh = buildNext({ sessionStartedAt: NOW });
      expect(fresh.expiresAt.getTime()).toBe(NOW.getTime() + env.JWT_REFRESH_EXPIRY_DAYS * DAY_MS);
    });

    it("on reuse, revokes the whole family, blocks its access tokens, notifies, then rejects", async () => {
      repo.rotate.mockResolvedValue({
        status: "reused",
        record: { userId: "user-1", familyId: "fam-1" },
      });

      const error = await service.rotate("stolen").catch((e) => e);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.reason).toBe(ERROR_REASONS.AUTH_REFRESH_REUSED);
      expect(repo.revokeFamily).toHaveBeenCalledWith("fam-1", "REUSE_DETECTED");
      expect(redis.set).toHaveBeenCalledWith("sessrev:fam-1", "1", "EX", env.JWT_ACCESS_EXPIRY);
      expect(events.emit).toHaveBeenCalledWith(SESSIONS_REVOKED_EVENT, {
        userId: "user-1",
        sessionIds: ["fam-1"],
        reason: "REUSE_DETECTED",
      });
    });

    it.each([
      ["expired", ERROR_REASONS.AUTH_REFRESH_EXPIRED],
      ["revoked", ERROR_REASONS.AUTH_REFRESH_INVALID],
      ["unknown", ERROR_REASONS.AUTH_REFRESH_INVALID],
    ])("maps %s to %s without touching other sessions", async (status, reason) => {
      repo.rotate.mockResolvedValue({ status, record: { userId: "u", familyId: "f" } });
      const error = await service.rotate("raw").catch((e) => e);
      expect(error.reason).toBe(reason);
      expect(repo.revokeFamily).not.toHaveBeenCalled();
    });
  });

  describe("revokeSessionByToken (logout)", () => {
    it("revokes the token's whole family without a socket push", async () => {
      repo.findByToken.mockResolvedValue({ userId: "user-1", familyId: "fam-1" });
      await service.revokeSessionByToken("raw");
      expect(repo.findByToken).toHaveBeenCalledWith(hashToken("raw"));
      expect(repo.revokeFamily).toHaveBeenCalledWith("fam-1", "LOGOUT");
      expect(redis.set).toHaveBeenCalledWith("sessrev:fam-1", "1", "EX", env.JWT_ACCESS_EXPIRY);
      expect(events.emit).not.toHaveBeenCalled();
    });

    it("is a no-op for an unknown token", async () => {
      repo.findByToken.mockResolvedValue(null);
      await expect(service.revokeSessionByToken("nope")).resolves.toBeUndefined();
      expect(repo.revokeFamily).not.toHaveBeenCalled();
    });
  });

  describe("revokeSessionById", () => {
    it("revokes the user's own session, blocks its access tokens and notifies", async () => {
      repo.revokeUserFamily.mockResolvedValue(1);
      await expect(service.revokeSessionById("user-1", "fam-1")).resolves.toBe(true);
      expect(repo.revokeUserFamily).toHaveBeenCalledWith("user-1", "fam-1", "SESSION_REVOKED");
      expect(redis.set).toHaveBeenCalledWith("sessrev:fam-1", "1", "EX", env.JWT_ACCESS_EXPIRY);
      expect(events.emit).toHaveBeenCalledWith(
        SESSIONS_REVOKED_EVENT,
        expect.objectContaining({ sessionIds: ["fam-1"] }),
      );
    });

    it("returns false and does nothing else when the session isn't theirs", async () => {
      repo.revokeUserFamily.mockResolvedValue(0);
      await expect(service.revokeSessionById("user-2", "fam-1")).resolves.toBe(false);
      expect(redis.set).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  it("cleanup keeps rows for a day past expiry so late replays still read as reuse", async () => {
    repo.deleteExpiredBefore.mockResolvedValue(2);
    await expect(service.cleanupExpiredTokens()).resolves.toBe(2);
    expect(repo.deleteExpiredBefore).toHaveBeenCalledWith(new Date(NOW.getTime() - DAY_MS));
  });
});
