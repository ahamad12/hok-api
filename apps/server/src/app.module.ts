import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { DbModule } from "@tapt-api/db";
import { env } from "@tapt-api/env/server";
import { WinstonModule } from "nest-winston";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RolesGuard } from "./common/guards/roles.guard";
import { ShopAccessGuard } from "./common/guards/shop-access.guard";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HealthModule } from "./health/health.module";
import { EmailModule } from "./infra/email/email.module";
import { FeatureFlagModule } from "./infra/feature-flags/feature-flag.module";
import { GatewayModule } from "./infra/gateway/gateway.module";
import { winstonConfig } from "./infra/logger/winston.module";
import { QueueModule } from "./infra/queue/queue.module";
import { SentryModule } from "./infra/sentry/sentry.module";
import { StorageModule } from "./infra/storage/storage.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ShopModule } from "./modules/shop/shop.module";
import { TillEntryModule } from "./modules/till-entry/till-entry.module";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DbModule,
    SentryModule,
    QueueModule,
    StorageModule,
    FeatureFlagModule,
    EmailModule,
    HealthModule,
    AuthModule,
    GatewayModule,
    ShopModule,
    TillEntryModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: "default",
            ttl: env.THROTTLE_TTL,
            limit: env.THROTTLE_LIMIT,
          },
        ],
        storage: env.REDIS_URL
          ? new ThrottlerStorageRedisService(env.REDIS_URL)
          : new ThrottlerStorageRedisService({
              host: env.REDIS_HOST,
              port: env.REDIS_PORT,
              password: env.REDIS_PASSWORD || undefined,
            }),
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
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ShopAccessGuard,
    },
  ],
})
export class AppModule {}
