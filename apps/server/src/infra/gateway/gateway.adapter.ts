import { Injectable } from "@nestjs/common";
import type { Socket } from "socket.io";
import { AccessTokenVerifierService } from "../../common/auth/access-token-verifier.service";
import { AuthenticationError } from "../../common/errors";
import type { RequestUser } from "../../common/types/request-user.interface";

/**
 * WebSocket connections have no middleware chain the way HTTP routes do —
 * there's no CanActivate equivalent that runs before handleConnection(), so
 * this is a plain injectable helper called explicitly from
 * AppGateway.handleConnection(), not a guard.
 *
 * Token verification itself (signature, schema, tokenVersion) is NOT
 * duplicated here — see AccessTokenVerifierService, which this and
 * JwtAuthGuard both call. This class's only job is handshake-specific:
 * finding where the token actually lives in a Socket.IO handshake.
 */
@Injectable()
export class GatewayAdapter {
  constructor(private readonly tokenVerifier: AccessTokenVerifierService) {}

  async authenticate(socket: Socket): Promise<RequestUser> {
    const rawToken = this.extractToken(socket);
    if (!rawToken) {
      throw new AuthenticationError("Missing authentication token");
    }
    return this.tokenVerifier.verify(rawToken);
  }

  /**
   * Checked in this order:
   *  1. handshake.auth.token — Socket.IO's documented mechanism, and what
   *     the mobile client contract specifies (`auth: { token: "Bearer ..." }`).
   *  2. handshake.headers.authorization — fallback for any client that
   *     can't set the `auth` field (older Socket.IO client versions, or a
   *     raw WebSocket test tool).
   * Both are expected in "Bearer <token>" form for consistency with the
   * HTTP side, even though Socket.IO's `auth` field doesn't require the
   * scheme prefix — stripping it here keeps token *extraction* the only
   * place that cares about transport differences.
   */
  private extractToken(socket: Socket): string | undefined {
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (authToken) return this.stripBearerPrefix(authToken);

    const headerToken = socket.handshake.headers?.authorization;
    if (typeof headerToken === "string") return this.stripBearerPrefix(headerToken);

    return undefined;
  }

  private stripBearerPrefix(value: string): string {
    const [scheme, token] = value.split(" ");
    return scheme === "Bearer" && token ? token : value;
  }
}
