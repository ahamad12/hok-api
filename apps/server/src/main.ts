import "./instrument";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { env } from "@tapt-api/env/server";
import helmet from "helmet";
import { WINSTON_MODULE_PROVIDER, WinstonModule } from "nest-winston";
import type { Logger } from "winston";
import { AppModule } from "./app.module";
import { RedisIoAdapter } from "./infra/gateway/redis-io.adapter";
import { winstonConfig } from "./infra/logger/winston.module";

function parseTrustProxy(value: string): boolean | number | string {
  if (value === "true") return true;
  if (value === "false" || value === "") return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  app.enableShutdownHooks();
  app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY));

  // API routing: versioning and the "/api" prefix live in the ts-rest contracts
  // (pathPrefix: "/api/v1" in packages/api/src/contracts/*). Do not re-add
  // app.setGlobalPrefix("api") or app.enableVersioning() here — they would
  // double-prefix to /api/v1/api/v1/... Health (/health) and docs (/api/docs)
  // are intentionally outside the contract prefix.

  if (env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("TAPT API")
      .setDescription("TAPT REST API documentation for mobile clients")
      .setVersion("1.0")
      .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "BearerAuth")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey,
    });

    SwaggerModule.setup("api/docs", app, document, {
      customSiteTitle: "TAPT API Docs",
    });
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "validator.swagger.io"],
        },
      },
    }),
  );

  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.useWebSocketAdapter(new RedisIoAdapter(app));

  await app.listen(env.PORT);

  const logger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  logger.info(`Server is running on http://localhost:${env.PORT}`);

  if (env.NODE_ENV !== "production") {
    logger.info(`Swagger docs available at http://localhost:${env.PORT}/api/docs`);
  }
}

bootstrap();
