import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { env } from "@tapt-api/env/server";
import { EmailProcessor } from "./processors/email.processor";
import { NotificationProcessor } from "./processors/notification.processor";

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: env.REDIS_URL
          ? { url: env.REDIS_URL, maxRetriesPerRequest: null }
          : {
              host: env.REDIS_HOST,
              port: env.REDIS_PORT,
              password: env.REDIS_PASSWORD || undefined,
              maxRetriesPerRequest: null,
            },
        prefix: `tapt:${env.NODE_ENV}`,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 3600 * 24 },
          removeOnFail: { age: 3600 * 24 * 7 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: "email" },
      { name: "notification" },
    ),
  ],
  providers: [EmailProcessor, NotificationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
