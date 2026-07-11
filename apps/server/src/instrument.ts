import * as Sentry from "@sentry/nestjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const dsn = process.env.SENTRY_DSN;
const environment = process.env.NODE_ENV || "development";

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: environment === "production" ? 0.2 : 1.0,
    profilesSampleRate: environment === "production" ? 0.2 : 1.0,
  });
} else {
  console.warn("[Sentry] SENTRY_DSN is not set. Instrumentation is disabled.");
}
