import "./instrument";
import "reflect-metadata";
import { VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { env } from "@tapt-api/env/server";
import helmet from "helmet";
import { WINSTON_MODULE_PROVIDER, WinstonModule } from "nest-winston";
import type { Logger } from "winston";
import { AppModule } from "./app.module";
import { winstonConfig } from "./infra/logger/winston.module";

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
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.listen(env.PORT);

  const logger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  logger.info(`Server is running on http://localhost:${env.PORT}`);

  if (env.NODE_ENV !== "production") {
    logger.info(`Swagger docs available at http://localhost:${env.PORT}/api/docs`);
  }
}

bootstrap();
