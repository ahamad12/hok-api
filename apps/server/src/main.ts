import "./instrument";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WinstonModule, WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import helmet from "helmet";
import { VersioningType } from "@nestjs/common";

import { AppModule } from "./app.module";
import { winstonConfig } from "./infra/logger/winston.module";
import { env } from "@tapt-api/env/server";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  app.enableShutdownHooks();

  app.setGlobalPrefix("api", {
    exclude: ["health", "metrics"],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: "v",
    defaultVersion: "1",
  });

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
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.listen(env.PORT);

  const logger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  logger.info(`Server is running on http://localhost:${env.PORT}`);
}

bootstrap();
