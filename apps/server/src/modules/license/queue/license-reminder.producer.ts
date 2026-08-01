import { InjectQueue } from "@nestjs/bullmq";
import type { OnModuleInit } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";

@Injectable()
export class LicenseReminderProducer implements OnModuleInit {
  constructor(@InjectQueue("license") private readonly licenseQueue: Queue) {}

  async onModuleInit() {
    await this.licenseQueue.add(
      "check-expiring",
      {},
      { repeat: { pattern: "0 9 * * *" }, jobId: "license-check-expiring-daily" },
    );
  }
}
