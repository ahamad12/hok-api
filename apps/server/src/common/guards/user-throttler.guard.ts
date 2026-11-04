// apps/server/src/common/guards/user-throttler.guard.ts
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerRequest } from "@nestjs/throttler";

// @nestjs/throttler's own metadata key prefix (throttler.constants.ts);
// @Throttle({ name: {...} }) stores the limit under THROTTLER:LIMIT<name>.
const THROTTLER_LIMIT_KEY = "THROTTLER:LIMIT";

/**
 * Per-user throttling (falls back to client IP on public routes).
 *
 * Named throttlers are opt-in. Out of the box, @nestjs/throttler v5+
 * applies EVERY throttler in ThrottlerModule to EVERY route, so the
 * "message-burst" (3/s) and "auth" (20/min) budgets meant for one or two
 * endpoints would cap the whole API. Here only "default" is global; any
 * other named throttler counts a request only when the route or its
 * controller declares it with @Throttle({ <name>: ... }).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.userId ?? req.ip;
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, throttler } = requestProps;
    const name = throttler.name ?? "default";
    if (name !== "default") {
      const optedIn = this.reflector.getAllAndOverride<unknown>(THROTTLER_LIMIT_KEY + name, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (optedIn === undefined) return true;
    }
    return super.handleRequest(requestProps);
  }
}

/**
 * Tracker for per-account budgets on credential endpoints (login, forgot
 * password): keyed on the normalised email from the body, so credential
 * stuffing against one account is limited even when spread across many
 * IPs. Hashed so raw emails never become Redis keys. Falls back to IP
 * when the body has no email (the contract will reject it anyway).
 */
export function emailTracker(req: Record<string, any>): string {
  const email = req.body?.email;
  if (typeof email !== "string" || email.length === 0) return `ip:${req.ip}`;
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `email:${digest}`;
}
