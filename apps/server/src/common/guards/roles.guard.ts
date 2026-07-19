import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { UserRole } from "@tapt-api/db";
import type { Request } from "express";
import { ROLES_KEY, SUPERVISOR_ONLY_KEY } from "../decorators/roles.decorator";
import type { RequestUser } from "../types/request-user.interface";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiresSupervisor = this.reflector.getAllAndOverride<boolean>(SUPERVISOR_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiresSupervisor) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      throw new ForbiddenException("No authenticated user found");
    }

    if (requiredRoles && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Access denied for role: ${user.role}`);
    }

    if (requiresSupervisor) {
      const isExempt = user.role === UserRole.OWNER || user.role === UserRole.MANAGER;
      if (!isExempt && !user.isSupervisor) {
        throw new ForbiddenException("Supervisor or above access required");
      }
    }

    return true;
  }
}
