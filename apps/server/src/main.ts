import "./instrument";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WinstonModule, WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { AppModule } from "./app.module";
import { winstonConfig } from "./infra/logger/winston.module";
import { env } from "@tapt-api/env/server";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  app.enableShutdownHooks();

  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.listen(env.PORT);

  const logger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  logger.info(`Server is running on http://localhost:${env.PORT}`);
}

bootstrap();
