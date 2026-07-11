import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { WinstonModule } from "nest-winston";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { winstonConfig } from "./infra/logger/winston.module";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { SentryModule } from "./infra/sentry/sentry.module";
import { env } from "@tapt-api/env/server";

@Module({
  imports: [
    SentryModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: "default",
            ttl: env.THROTTLE_TTL,
            limit: env.THROTTLE_LIMIT,
          },
        ],
        storage: new ThrottlerStorageRedisService(
          env.REDIS_URL
            ? env.REDIS_URL
            : {
                host: env.REDIS_HOST,
                port: env.REDIS_PORT,
                password: env.REDIS_PASSWORD || undefined,
              },
        ),
      }),
    }),
    WinstonModule.forRoot(winstonConfig),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
