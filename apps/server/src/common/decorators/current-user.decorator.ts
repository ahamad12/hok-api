import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { RequestUser } from "../types/request-user.interface";

export const CurrentUser = createParamDecorator(
  (
    data: keyof RequestUser | undefined,
    ctx: ExecutionContext,
  ): RequestUser | RequestUser[keyof RequestUser] => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        "CurrentUser decorator requires JwtAuthGuard to be applied first",
      );
    }

    return data ? user[data] : user;
  },
);
