import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AccessTokenVerifierService } from "../auth/access-token-verifier.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthenticationError, ERROR_REASONS } from "../errors";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenVerifier: AccessTokenVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new AuthenticationError("Missing bearer token", ERROR_REASONS.AUTH_TOKEN_MISSING);
    }

    request.user = await this.tokenVerifier.verify(token);
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [scheme, token] = header.split(" ");
    return scheme === "Bearer" && token ? token : undefined;
  }
}
