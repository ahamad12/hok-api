import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { env } from "@tapt-api/env/server";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

const jwtPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
  shopId: z.string().nullable(),
  isSupervisor: z.boolean(),
});

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing authentication token");
    }

    try {
      const decoded = await new Promise<unknown>((resolve, reject) => {
        jwt.verify(token, env.JWT_SECRET, (err, payload) => {
          if (err) reject(err);
          else resolve(payload);
        });
      });
      const result = jwtPayloadSchema.safeParse(decoded);
      if (!result.success) {
        throw new UnauthorizedException("Invalid token payload");
      }
      request.user = {
        userId: result.data.userId,
        email: result.data.email,
        role: result.data.role,
        shopId: result.data.shopId,
        isSupervisor: result.data.isSupervisor,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(" ");
    return type === "Bearer" ? token : undefined;
  }
}
