import type { Socket } from "socket.io";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "../../../common/errors";
import { UserRole } from "../../../test/prisma-client-mock";
import { GatewayAdapter } from "../gateway.adapter";

function buildSocket(overrides: Partial<Socket["handshake"]> = {}): Socket {
  return {
    handshake: { auth: {}, headers: {}, ...overrides },
  } as unknown as Socket;
}

describe("GatewayAdapter", () => {
  let tokenVerifier: { verify: ReturnType<typeof vi.fn> };
  let adapter: GatewayAdapter;

  const validUser = {
    userId: "user-1",
    email: "staff@shop.test",
    role: UserRole.STAFF,
    shopId: "shop-1",
    isSupervisor: false,
  };

  beforeEach(() => {
    tokenVerifier = { verify: vi.fn() };
    adapter = new GatewayAdapter(tokenVerifier as any);
  });

  it("extracts the token from handshake.auth.token and delegates to the verifier", async () => {
    tokenVerifier.verify.mockResolvedValue(validUser);
    const socket = buildSocket({ auth: { token: "Bearer abc.def.ghi" } });

    const result = await adapter.authenticate(socket);

    expect(tokenVerifier.verify).toHaveBeenCalledWith("abc.def.ghi");
    expect(result).toEqual(validUser);
  });

  it("falls back to handshake.headers.authorization when auth.token is absent", async () => {
    tokenVerifier.verify.mockResolvedValue(validUser);
    const socket = buildSocket({ auth: {}, headers: { authorization: "Bearer xyz.123" } });

    await adapter.authenticate(socket);
    expect(tokenVerifier.verify).toHaveBeenCalledWith("xyz.123");
  });

  it("tolerates a bare token with no 'Bearer ' prefix", async () => {
    tokenVerifier.verify.mockResolvedValue(validUser);
    const socket = buildSocket({ auth: { token: "bare-token-no-prefix" } });

    await adapter.authenticate(socket);
    expect(tokenVerifier.verify).toHaveBeenCalledWith("bare-token-no-prefix");
  });

  it("throws AuthenticationError when neither auth.token nor an authorization header is present", async () => {
    const socket = buildSocket();
    await expect(adapter.authenticate(socket)).rejects.toThrow(AuthenticationError);
    expect(tokenVerifier.verify).not.toHaveBeenCalled();
  });

  it("propagates AuthenticationError from an expired/invalid token", async () => {
    tokenVerifier.verify.mockRejectedValue(new AuthenticationError("Invalid or expired token"));
    const socket = buildSocket({ auth: { token: "Bearer expired.token" } });
    await expect(adapter.authenticate(socket)).rejects.toThrow(AuthenticationError);
  });

  it("propagates AuthenticationError from a tokenVersion mismatch (session invalidated)", async () => {
    tokenVerifier.verify.mockRejectedValue(
      new AuthenticationError("Session invalidated. Please login again."),
    );
    const socket = buildSocket({ auth: { token: "Bearer stale.token" } });
    await expect(adapter.authenticate(socket)).rejects.toThrow("Session invalidated");
  });
});
