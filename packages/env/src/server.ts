import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGIN: z.string().url(),
    DATABASE_URL: z.string().url(),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_FROM_EMAIL: z.string().email().default("noreply@example.com"),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().default("development"),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1.0),
    SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
    GROWTHBOOK_API_HOST: z.string().url().default("https://cdn.growthbook.io"),
    GROWTHBOOK_CLIENT_KEY: z.string().optional(),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_URL: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
    JWT_SECRET: z.string().trim().min(32),
    JWT_ACCESS_EXPIRY: z.coerce.number().int().positive().default(900),
    // Refresh tokens are opaque random values (SHA-256 at rest), not JWTs —
    // there is intentionally no JWT_REFRESH_SECRET. TTL is in days so it
    // stays in sync with TokenService.
    JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),
    BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
