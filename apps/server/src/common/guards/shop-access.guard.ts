import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { RequestUser } from "../types/request-user.interface";

export const SHOP_ACCESS_PARAM_KEY = "SHOP_ACCESS_PARAM_KEY";
export const ShopAccess = (paramKey = "shopId") => SetMetadata(SHOP_ACCESS_PARAM_KEY, paramKey);

@Injectable()
export class ShopAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      throw new ForbiddenException("No authenticated user found");
    }

    if (user.role === "OWNER" || user.role === "MANAGER") {
      return true;
    }

    const paramKey = this.reflector.getAllAndOverride<string>(SHOP_ACCESS_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? "shopId";

    const targetShopId = request.params[paramKey];

    if (!targetShopId) {
      return true;
    }

    if (user.shopId !== targetShopId) {
      throw new ForbiddenException("Access denied for this shop");
    }

    return true;
  }
}
