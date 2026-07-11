import { Injectable } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

export interface ErrorContext {
  queue?: string;
  jobId?: string;
  userId?: string;
  [key: string]: unknown;
}

@Injectable()
export class SentryService implements OnApplicationShutdown {
  captureException(exception: unknown, context?: ErrorContext) {
    return Sentry.captureException(exception, {
      tags: context,
    });
  }

  captureMessage(message: string, level?: Sentry.SeverityLevel) {
    return Sentry.captureMessage(message, level);
  }

  setUser(user: Sentry.User | null) {
    Sentry.setUser(user);
  }

  addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
    Sentry.addBreadcrumb(breadcrumb);
  }

  withSpan<T>(name: string, callback: () => T | Promise<T>): Promise<T> {
    return Sentry.startSpan({ name }, callback);
  }

  async onApplicationShutdown() {
    await Sentry.close(2000);
  }
}
