import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { SHOP_ACCESS_PARAM_KEY } from "../decorators";
import { canAccessShop } from "../domain/shop-access";
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

    const targetShopId = request.params[paramKey];

    if (typeof targetShopId !== "string" || targetShopId.length === 0) {
      throw new BadRequestException("Missing shop ID parameter");
    }

    // STAFF: own shop only. OWNER/MANAGER: shops of their tenant only.
    if (!canAccessShop(user, targetShopId)) {
      throw new ForbiddenException("Access denied for this shop");
    }

    return true;
  }
}
