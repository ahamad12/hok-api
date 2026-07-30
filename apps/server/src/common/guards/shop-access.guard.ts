import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { UserRole } from "@tapt-api/db";
import type { Request } from "express";
import { SHOP_ACCESS_PARAM_KEY } from "../decorators";
import type { RequestUser } from "../types/request-user.interface";

@Injectable()
export class ShopAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const paramKey = this.reflector.getAllAndOverride<string>(SHOP_ACCESS_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!paramKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      throw new ForbiddenException("No authenticated user found");
    }

    if (user.role === UserRole.OWNER || user.role === UserRole.MANAGER) {
      return true;
    }

    const targetShopId = request.params[paramKey];

    if (!targetShopId) {
      throw new BadRequestException("Missing shop ID parameter");
    }

    if (user.shopId !== targetShopId) {
      throw new ForbiddenException("Access denied for this shop");
    }

    return true;
  }
}
