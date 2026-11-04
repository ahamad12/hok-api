// common/auth/auth-mailer.service.ts — emails that carry one-time auth links.
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { env } from "@tapt-api/env/server";
import type { Queue } from "bullmq";

export type AuthLinkPath = "invite" | "reset-password" | "verify-email";

/** Deep link the mobile app opens: <APP_LINK_BASE_URL>/<path>?token=<raw>. */
export function authLink(
  path: AuthLinkPath,
  rawToken: string,
  base: string = env.APP_LINK_BASE_URL,
): string {
  // "tapt://" (scheme only) → "tapt://invite"; "https://x.app/" → "https://x.app/invite"
  const root = /^[a-z][a-z0-9+.-]*:\/\/$/i.test(base) ? base : `${base.replace(/\/+$/, "")}/`;
  return `${root}${path}?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Queues auth emails on the shared "email" queue (EmailProcessor →
 * SendGrid). The job body contains a live one-time link, so the job is
 * removed from Redis as soon as it completes instead of being kept for
 * the queue's default 24h.
 */
@Injectable()
export class AuthMailerService {
  constructor(@InjectQueue("email") private readonly emailQueue: Queue) {}

  async send(kind: string, to: string, subject: string, body: string): Promise<void> {
    await this.emailQueue.add(
      `auth:${kind}`,
      { to, subject, body },
      { removeOnComplete: true, removeOnFail: { age: 24 * 3600 } },
    );
  }
}
