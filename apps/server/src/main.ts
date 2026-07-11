import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WinstonModule } from "nest-winston";

import { AppModule } from "./app.module";
import { winstonConfig } from "./infra/logger/winston.module";
import { env } from "@tapt-api/env/server";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.listen(env.PORT);
  console.log(`Server is running on http://localhost:${env.PORT}`);
}

bootstrap();
