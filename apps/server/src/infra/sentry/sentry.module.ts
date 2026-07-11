import { Global, Module } from "@nestjs/common";
import { SentryModule as NestSentryModule } from "@sentry/nestjs/setup";
import { SentryService } from "./sentry.service";

@Global()
@Module({
  imports: [NestSentryModule.forRoot()],
  providers: [SentryService],
  exports: [SentryService],
})
export class SentryModule {}
