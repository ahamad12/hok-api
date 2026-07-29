import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildUser } from "../../../test/fixtures/user.fixture";
import { UserRole } from "../../../test/prisma-client-mock";
import { createRedisClientMock, type RedisClientMock } from "../../../test/redis-client-mock";
import { AuthenticationError } from "../../errors";
import { AccessTokenVerifierService } from "../access-token-verifier.service";

describe("AccessTokenVerifierService", () => {
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let redis: RedisClientMock;
  let userRepository: { findById: ReturnType<typeof vi.fn> };
  let service: AccessTokenVerifierService;

  const UUID = "123e4567-e89b-12d3-a456-426614174000";
  const SHOP_UUID = "223e4567-e89b-12d3-a456-426614174001";

  const validPayload = {
    userId: UUID,
    email: "staff@shop.test",
    role: UserRole.STAFF,
    shopId: SHOP_UUID,
    isSupervisor: false,
    tokenVersion: 0,
  };

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    redis = createRedisClientMock();
    userRepository = { findById: vi.fn() };
    service = new AccessTokenVerifierService(
      jwtService as any,
      redis as any,
      userRepository as any,
    );
  });

  it("throws AuthenticationError on signature/expiry failure", async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error("jwt expired"));
    await expect(service.verify("bad")).rejects.toThrow(AuthenticationError);
  });

  it("throws AuthenticationError when the decoded payload fails schema validation", async () => {
    jwtService.verifyAsync.mockResolvedValue({ userId: "not-a-uuid" });
    await expect(service.verify("x")).rejects.toThrow(AuthenticationError);
  });

  it("throws AuthenticationError on a tokenVersion mismatch (Redis cache hit)", async () => {
    jwtService.verifyAsync.mockResolvedValue(validPayload);
    redis.get.mockResolvedValue("5");
    await expect(service.verify("x")).rejects.toThrow(AuthenticationError);
  });

  it("falls through to Postgres on a Redis miss, populates the cache, and succeeds", async () => {
    jwtService.verifyAsync.mockResolvedValue(validPayload);
    redis.get.mockResolvedValue(null);
    userRepository.findById.mockResolvedValue(
      buildUser({ id: UUID, tokenVersion: 0, isActive: true }),
    );

    const result = await service.verify("x");

    expect(result).toEqual({
      userId: UUID,
      email: "staff@shop.test",
      role: UserRole.STAFF,
      shopId: SHOP_UUID,
      isSupervisor: false,
    });
    expect(redis.set).toHaveBeenCalledWith(`tokenver:${UUID}`, 0, "EX", 3600);
  });

  it("throws AuthenticationError on Redis miss when the user is deactivated", async () => {
    jwtService.verifyAsync.mockResolvedValue(validPayload);
    redis.get.mockResolvedValue(null);
    userRepository.findById.mockResolvedValue(buildUser({ isActive: false }));
    await expect(service.verify("x")).rejects.toThrow(AuthenticationError);
  });

  it("never returns tokenVersion on the resulting RequestUser", async () => {
    jwtService.verifyAsync.mockResolvedValue(validPayload);
    redis.get.mockResolvedValue("0");
    const result = await service.verify("x");
    expect(result).not.toHaveProperty("tokenVersion");
  });
});
