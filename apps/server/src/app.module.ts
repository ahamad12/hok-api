import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { WinstonModule } from "nest-winston";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { winstonConfig } from "./infra/logger/winston.module";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { SentryModule } from "./infra/sentry/sentry.module";

@Module({
  imports: [SentryModule, WinstonModule.forRoot(winstonConfig)],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
