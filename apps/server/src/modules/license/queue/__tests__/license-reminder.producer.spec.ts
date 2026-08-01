import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseReminderProducer } from "../license-reminder.producer";

describe("LicenseReminderProducer", () => {
  let licenseQueue: { add: ReturnType<typeof vi.fn> };
  let producer: LicenseReminderProducer;

  beforeEach(() => {
    licenseQueue = { add: vi.fn().mockResolvedValue(undefined) };
    producer = new LicenseReminderProducer(licenseQueue as any);
  });

  it("registers a repeatable check-expiring job on module init", async () => {
    await producer.onModuleInit();
    expect(licenseQueue.add).toHaveBeenCalledWith(
      "check-expiring",
      {},
      expect.objectContaining({ repeat: { pattern: "0 9 * * *" } }),
    );
  });

  it("uses a stable jobId so re-registration on restart is idempotent, not duplicated", async () => {
    await producer.onModuleInit();
    expect(licenseQueue.add).toHaveBeenCalledWith(
      "check-expiring",
      {},
      expect.objectContaining({ jobId: "license-check-expiring-daily" }),
    );
  });

  it("passes an empty payload — the job carries no per-run data, the processor re-derives everything from the DB", async () => {
    await producer.onModuleInit();
    const [, payload] = licenseQueue.add.mock.calls[0]!;
    expect(payload).toEqual({});
  });
});
