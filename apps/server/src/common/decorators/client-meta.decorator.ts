import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface ClientMeta {
  /** Client IP as Express resolved it (honours TRUST_PROXY). */
  ipAddress: string | null;
  userAgent: string | null;
}

const MAX_USER_AGENT = 512;
const MAX_IP = 64;

/** Who is calling, for session/device records. Values are truncated to the
 *  column sizes on refresh_tokens. */
export const CurrentClient = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const ua = req.headers["user-agent"];
  return {
    ipAddress: req.ip ? req.ip.slice(0, MAX_IP) : null,
    userAgent: typeof ua === "string" && ua.length > 0 ? ua.slice(0, MAX_USER_AGENT) : null,
  } satisfies ClientMeta;
});
