import { Inject } from "@nestjs/common";
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { type SocketEventName, socketEventSchemas } from "@tapt-api/api/events";
import { UserRole } from "@tapt-api/db";
import { env } from "@tapt-api/env/server";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Server, Socket } from "socket.io";
import type { Logger } from "winston";
import { shopRoom, tenantAdminRoom, userRoom } from "../../common/constants/rooms";
import type { SocketEventEnvelope } from "../../common/types/socket-event";
import { GatewayAdapter } from "./gateway.adapter";

@WebSocketGateway({
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true,
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly gatewayAdapter: GatewayAdapter,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const user = await this.gatewayAdapter.authenticate(socket);
      socket.data.user = user;

      await socket.join(userRoom(user.userId));
      if (user.shopId) {
        await socket.join(shopRoom(user.shopId));
      }
      if ((user.role === UserRole.OWNER || user.role === UserRole.MANAGER) && user.tenantId) {
        await socket.join(tenantAdminRoom(user.tenantId));
      }

      this.logger.info("WebSocket connected", { userId: user.userId, socketId: socket.id });
    } catch (error) {
      this.logger.warn("WebSocket authentication failed", {
        socketId: socket.id,
        reason: error instanceof Error ? error.message : "unknown",
      });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.info("WebSocket disconnected", {
      userId: socket.data.user?.userId,
      socketId: socket.id,
    });
  }

  emitToUser<E extends SocketEventName>(userId: string, event: E, data: unknown): void {
    this.validatedEmit(userRoom(userId), event, data, null);
  }

  emitToShop<E extends SocketEventName>(shopId: string, event: E, data: unknown): void {
    this.validatedEmit(shopRoom(shopId), event, data, shopId);
  }

  emitToTenantAdmins<E extends SocketEventName>(tenantId: string, event: E, data: unknown): void {
    this.validatedEmit(tenantAdminRoom(tenantId), event, data, null);
  }

  private validatedEmit<E extends SocketEventName>(
    room: string,
    event: E,
    data: unknown,
    shopId: string | null,
  ): void {
    const schema = socketEventSchemas[event];
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      this.logger.error("Refusing to emit — payload failed schema validation", {
        event,
        room,
        issues: parsed.error.issues,
      });
      return;
    }

    const envelope: SocketEventEnvelope<unknown> = {
      event,
      shopId,
      occurredAt: new Date().toISOString(),
      data: parsed.data,
    };

    this.safeEmit(room, event, envelope);
  }

  private safeEmit(room: string, event: string, data: unknown): void {
    try {
      this.server.to(room).emit(event, data);
    } catch (error) {
      this.logger.error("WebSocket emit failed", {
        room,
        event,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
