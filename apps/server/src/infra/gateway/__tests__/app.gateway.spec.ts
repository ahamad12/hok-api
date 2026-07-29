import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocketEventEnvelope } from "../../../common/types/socket-event";
import { UserRole } from "../../../test/prisma-client-mock";
import { AppGateway } from "../app.gateway";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const SHOP_UUID = "223e4567-e89b-12d3-a456-426614174001";

const staffUser = {
  userId: UUID,
  email: "staff@shop.test",
  role: UserRole.STAFF,
  shopId: SHOP_UUID,
  isSupervisor: false,
};

const ownerUser = {
  userId: UUID,
  email: "owner@test.com",
  role: UserRole.OWNER,
  shopId: null,
  isSupervisor: false,
};

function makeFakeSocket(overrides?: Record<string, any>): any {
  return {
    id: "socket-1",
    handshake: { auth: {}, headers: {} },
    join: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    data: {},
    ...overrides,
  };
}

describe("AppGateway", () => {
  let adapter: { authenticate: ReturnType<typeof vi.fn> };
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let gateway: AppGateway;

  beforeEach(() => {
    adapter = { authenticate: vi.fn() };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    gateway = new AppGateway(adapter as any, logger as any);
    (gateway as any).server = { to: vi.fn().mockReturnValue({ emit: vi.fn() }) };
  });

  describe("handleConnection", () => {
    it("joins user and shop rooms for a STAFF user", async () => {
      adapter.authenticate.mockResolvedValue(staffUser);

      const client = makeFakeSocket();
      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith(`user:${UUID}`);
      expect(client.join).toHaveBeenCalledWith(`shop:${SHOP_UUID}`);
      expect(client.join).not.toHaveBeenCalledWith("admin");
      expect(client.data.user).toEqual(staffUser);
    });

    it("joins admin room for OWNER", async () => {
      adapter.authenticate.mockResolvedValue(ownerUser);

      const client = makeFakeSocket();
      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith(`user:${UUID}`);
      expect(client.join).toHaveBeenCalledWith("admin");
    });

    it("disconnects when authentication fails", async () => {
      adapter.authenticate.mockRejectedValue(new Error("bad token"));

      const client = makeFakeSocket();
      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("handleDisconnect", () => {
    it("logs the disconnected user", async () => {
      const client = makeFakeSocket({ data: { user: staffUser } });
      await gateway.handleDisconnect(client);

      expect(logger.info).toHaveBeenCalledWith("WebSocket disconnected", {
        userId: UUID,
        socketId: "socket-1",
      });
    });
  });

  describe("emitToUser", () => {
    it("emits a validated envelope to the user room", () => {
      const server = (gateway as any).server;
      gateway.emitToUser(UUID, SOCKET_EVENTS.SESSION_REVOKED, { message: "test" });

      expect(server.to).toHaveBeenCalledWith(`user:${UUID}`);
      const envelope: SocketEventEnvelope<unknown> = server.to(UUID).emit.mock.calls[0][1];
      expect(server.to(UUID).emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_REVOKED,
        expect.objectContaining({
          event: SOCKET_EVENTS.SESSION_REVOKED,
          shopId: null,
          data: { message: "test" },
        }),
      );
      expect(envelope.occurredAt).toBeDefined();
    });
  });

  describe("emitToShop", () => {
    it("emits a validated envelope to the shop room with shopId set", () => {
      const server = (gateway as any).server;
      gateway.emitToShop(SHOP_UUID, SOCKET_EVENTS.TASK_UPDATED, {
        taskId: "123e4567-e89b-12d3-a456-426614174002",
        status: "DONE",
      });

      expect(server.to).toHaveBeenCalledWith(`shop:${SHOP_UUID}`);
      const envelope: SocketEventEnvelope<unknown> = server.to(SHOP_UUID).emit.mock.calls[0][1];
      expect(envelope.shopId).toBe(SHOP_UUID);
      expect(envelope.data).toEqual({
        taskId: "123e4567-e89b-12d3-a456-426614174002",
        status: "DONE",
      });
    });
  });

  describe("emitToAdmins", () => {
    it("emits a validated envelope to the admin room", () => {
      const server = (gateway as any).server;
      gateway.emitToAdmins(SOCKET_EVENTS.LICENSE_EXPIRING, {
        licenseId: "123e4567-e89b-12d3-a456-426614174003",
        productName: "Test",
        expiryDate: new Date("2026-12-31"),
        daysRemaining: 5,
      });

      expect(server.to).toHaveBeenCalledWith("admin");
      const envelope: SocketEventEnvelope<unknown> = server.to("admin").emit.mock.calls[0][1];
      expect(envelope.shopId).toBeNull();
    });
  });

  describe("validatedEmit", () => {
    it("logs an error and does not emit when the payload fails schema validation", () => {
      const server = (gateway as any).server;
      gateway.emitToUser(UUID, SOCKET_EVENTS.SESSION_REVOKED, { message: 42 });

      expect(logger.error).toHaveBeenCalledWith(
        "Refusing to emit — payload failed schema validation",
        expect.objectContaining({ event: SOCKET_EVENTS.SESSION_REVOKED }),
      );
      expect(server.to().emit).not.toHaveBeenCalled();
    });
  });

  describe("safeEmit", () => {
    it("swallows emit errors gracefully", () => {
      const server = (gateway as any).server;
      server.to.mockImplementation(() => {
        throw new Error("server closed");
      });

      gateway.emitToUser(UUID, SOCKET_EVENTS.SESSION_REVOKED, { message: "test" });
      expect(logger.error).toHaveBeenCalledWith("WebSocket emit failed", expect.any(Object));
    });
  });
});
