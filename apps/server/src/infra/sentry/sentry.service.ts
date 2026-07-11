import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

@Injectable()
export class SentryService implements OnApplicationShutdown {
  captureException(exception: unknown, hint?: Sentry.EventHint) {
    return Sentry.captureException(exception, hint);
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
