import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule } from "@nestjs/throttler";
import { DbModule } from "@tapt-api/db";
import { env } from "@tapt-api/env/server";
import { WinstonModule } from "nest-winston";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { ShopAccessGuard } from "./common/guards/shop-access.guard";
import { UserThrottlerGuard } from "./common/guards/user-throttler.guard";
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
import { CategoryModule } from "./modules/category/category.module";
import { DailySummaryModule } from "./modules/daily-summary/daily-summary.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { ExpenseModule } from "./modules/expense/expense.module";
import { ExpenseCategoryModule } from "./modules/expense-category/expense-category.module";
import { FormModule } from "./modules/form/form.module";
import { LicenseModule } from "./modules/license/license.module";
import { ProfitReportModule } from "./modules/profit-report/profit-report.module";
import { ScratchModule } from "./modules/scratch/scratch.module";
import { ShopModule } from "./modules/shop/shop.module";
import { SupplierModule } from "./modules/supplier/supplier.module";
import { TaskModule } from "./modules/task/task.module";
import { TicketModule } from "./modules/ticket/ticket.module";
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
    ScratchModule,
    LicenseModule,
    // Order matters here — CategoryModule before SupplierModule before
    // DeliveryModule, matching the actual dependency chain.
    CategoryModule,
    SupplierModule,
    DeliveryModule,
    TaskModule,
    TicketModule,
    FormModule,
    ExpenseCategoryModule,
    ExpenseModule,
    DailySummaryModule,
    ProfitReportModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: "default",
            ttl: env.THROTTLE_TTL,
            limit: env.THROTTLE_LIMIT,
          },
          {
            name: "message-burst",
            ttl: 1000,
            limit: 3,
          },
          {
            name: "message-sustained",
            ttl: 60000,
            limit: 30,
          },
          {
            // Stricter per-IP budget for public auth endpoints
            // (register/login/refresh). Applied via @Throttle on
            // AuthController; everything else uses "default".
            name: "auth",
            ttl: 60000,
            limit: 20,
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
    // Guard order is load-bearing: JwtAuthGuard must run first to populate
    // request.user (via AccessTokenVerifierService) before any guard that
    // reads it. UserThrottlerGuard uses req.user?.userId for per-user
    // throttling, RolesGuard/ShopAccessGuard check request.user for auth.
    // Previously JwtAuthGuard lived in AuthModule as APP_GUARD and ran
    // after AppModule's guards for some controllers (POST /shops, POST
    // /forms) causing 403 "No authenticated user found" despite valid
    // Bearer token — GET without @Roles succeeded, POST with @Roles failed.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
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
