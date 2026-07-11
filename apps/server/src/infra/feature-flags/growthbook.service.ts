import { GrowthBook } from "@growthbook/growthbook";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { env } from "@tapt-api/env/server";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

@Injectable()
export class GrowthBookService implements OnApplicationBootstrap, OnApplicationShutdown {
  private gb: GrowthBook | null = null;

  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  async onApplicationBootstrap() {
    if (!env.GROWTHBOOK_CLIENT_KEY) {
      this.logger.warn("GROWTHBOOK_CLIENT_KEY not set — feature flags will default to off");
      return;
    }
    try {
      this.gb = new GrowthBook({
        apiHost: env.GROWTHBOOK_API_HOST,
        clientKey: env.GROWTHBOOK_CLIENT_KEY,
        backgroundSync: true,
      });
      await this.gb.init({ timeout: 2000 });
      this.logger.info("GrowthBook initialized with remote features");
    } catch (err) {
      this.logger.error("GrowthBook init failed — flags will default to off", { error: err });
    }
  }

  isEnabled(featureKey: string, attributes: Record<string, unknown> = {}): boolean {
    if (!this.gb) return false;
    const scoped = new GrowthBook({ attributes });
    scoped.setFeatures(this.gb.getFeatures());
    return scoped.isOn(featureKey);
  }

  getValue<T>(featureKey: string, defaultValue: T, attributes: Record<string, unknown> = {}): T {
    if (!this.gb) return defaultValue;
    const scoped = new GrowthBook({ attributes });
    scoped.setFeatures(this.gb.getFeatures());
    return scoped.getFeatureValue(featureKey, defaultValue) as T;
  }

  async onApplicationShutdown() {
    await this.gb?.destroy();
  }
}
