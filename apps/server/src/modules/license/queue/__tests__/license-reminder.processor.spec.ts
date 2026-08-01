import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { LicenseReminderProcessor } from "../license-reminder.processor";

describe("LicenseReminderProcessor", () => {
  let licenseRepository: { findCandidatesForReminder: ReturnType<typeof vi.fn> };
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let userRepository: { findById: ReturnType<typeof vi.fn> };
  let redis: { set: ReturnType<typeof vi.fn> };
  let gateway: { emitToShop: ReturnType<typeof vi.fn> };
  let emailQueue: { add: ReturnType<typeof vi.fn> };
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let processor: LicenseReminderProcessor;

  const soonExpiring = buildLicense({
    id: "license-1",
    shopId: "shop-1",
    remindDays: 7,
    currentExpiryDate: new Date(Date.now() + 3 * 86_400_000),
  });

  beforeEach(() => {
    licenseRepository = { findCandidatesForReminder: vi.fn().mockResolvedValue([soonExpiring]) };
    shopRepository = { findById: vi.fn().mockResolvedValue({ id: "shop-1", ownerId: "owner-1" }) };
    userRepository = {
      findById: vi.fn().mockResolvedValue({ id: "owner-1", email: "owner@shop.test" }),
    };
    redis = { set: vi.fn().mockResolvedValue("OK") };
    gateway = { emitToShop: vi.fn() };
    emailQueue = { add: vi.fn() };
    logger = { info: vi.fn(), warn: vi.fn() };
    processor = new LicenseReminderProcessor(
      licenseRepository as any,
      shopRepository as any,
      userRepository as any,
      redis as any,
      gateway as any,
      emailQueue as any,
      logger as any,
    );
  });

  it("ignores jobs whose name isn't check-expiring", async () => {
    await processor.process({ name: "something-else" } as any);
    expect(licenseRepository.findCandidatesForReminder).not.toHaveBeenCalled();
  });

  it("does not reminder a license outside its own remindDays window", async () => {
    const farOut = buildLicense({
      id: "license-2",
      remindDays: 7,
      currentExpiryDate: new Date(Date.now() + 60 * 86_400_000),
    });
    licenseRepository.findCandidatesForReminder.mockResolvedValue([farOut]);
    await processor.process({ name: "check-expiring" } as any);
    expect(gateway.emitToShop).not.toHaveBeenCalled();
    expect(emailQueue.add).not.toHaveBeenCalled();
  });

  it("skips a license whose dedup key is already set (NX returned null)", async () => {
    redis.set.mockResolvedValue(null);
    await processor.process({ name: "check-expiring" } as any);
    expect(gateway.emitToShop).not.toHaveBeenCalled();
    expect(emailQueue.add).not.toHaveBeenCalled();
  });

  it("scopes the dedup key to license id + current expiry date", async () => {
    await processor.process({ name: "check-expiring" } as any);
    const [key] = redis.set.mock.calls[0]!;
    expect(key).toBe(`license-remind:license-1:${soonExpiring.currentExpiryDate!.toISOString()}`);
  });

  it("scales the dedup TTL with the license's own remindDays", async () => {
    await processor.process({ name: "check-expiring" } as any);
    const [, , , ttlArg] = redis.set.mock.calls[0]!; // ("key", "1", "EX", ttl, "NX")
    expect(ttlArg).toBe(7 * 86_400);
  });

  it("floors the dedup TTL at one day when remindDays is 0", async () => {
    const zeroWindow = buildLicense({
      id: "license-3",
      remindDays: 0,
      currentExpiryDate: new Date(),
    });
    licenseRepository.findCandidatesForReminder.mockResolvedValue([zeroWindow]);
    await processor.process({ name: "check-expiring" } as any);
    const [, , , ttlArg] = redis.set.mock.calls[0]!;
    expect(ttlArg).toBe(86_400);
  });

  it("resolves the shop, then the owner, before emitting or enqueuing anything", async () => {
    await processor.process({ name: "check-expiring" } as any);
    expect(shopRepository.findById).toHaveBeenCalledWith("shop-1");
    expect(userRepository.findById).toHaveBeenCalledWith("owner-1");
  });

  it("skips the license (no emit, no enqueue) when the shop can't be found", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await processor.process({ name: "check-expiring" } as any);
    expect(gateway.emitToShop).not.toHaveBeenCalled();
    expect(emailQueue.add).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("skips the license (no emit, no enqueue) when the owner user can't be found", async () => {
    userRepository.findById.mockResolvedValue(null);
    await processor.process({ name: "check-expiring" } as any);
    expect(gateway.emitToShop).not.toHaveBeenCalled();
    expect(emailQueue.add).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("emits SOCKET_EVENTS.LICENSE_EXPIRING to the license's shop with the correct payload", async () => {
    await processor.process({ name: "check-expiring" } as any);
    expect(gateway.emitToShop).toHaveBeenCalledWith(
      "shop-1",
      "license:expiring",
      expect.objectContaining({
        licenseId: "license-1",
        productName: soonExpiring.productName,
        expiryDate: soonExpiring.currentExpiryDate,
        daysRemaining: 3,
      }),
    );
  });

  it("enqueues the email job addressed to the resolved owner email, not a placeholder", async () => {
    await processor.process({ name: "check-expiring" } as any);
    expect(emailQueue.add).toHaveBeenCalledWith(
      "license-expiry",
      expect.objectContaining({ to: "owner@shop.test" }),
      { attempts: 3 },
    );
  });

  it("includes productName, licenseNumber, daysRemaining, and expiryDate in the email template data", async () => {
    await processor.process({ name: "check-expiring" } as any);
    const [, jobData] = emailQueue.add.mock.calls[0]!;
    expect(jobData.templateData).toMatchObject({
      productName: soonExpiring.productName,
      licenseNumber: soonExpiring.licenseNumber,
      daysRemaining: 3,
      expiryDate: soonExpiring.currentExpiryDate,
    });
  });

  it("processes multiple expiring licenses independently in one job run", async () => {
    const second = buildLicense({
      id: "license-4",
      shopId: "shop-1",
      remindDays: 7,
      currentExpiryDate: new Date(Date.now() + 1 * 86_400_000),
    });
    licenseRepository.findCandidatesForReminder.mockResolvedValue([soonExpiring, second]);
    await processor.process({ name: "check-expiring" } as any);
    expect(gateway.emitToShop).toHaveBeenCalledTimes(2);
    expect(emailQueue.add).toHaveBeenCalledTimes(2);
  });

  it("continues processing remaining licenses if one is deduped mid-batch", async () => {
    const second = buildLicense({
      id: "license-4",
      shopId: "shop-1",
      remindDays: 7,
      currentExpiryDate: new Date(Date.now() + 1 * 86_400_000),
    });
    licenseRepository.findCandidatesForReminder.mockResolvedValue([soonExpiring, second]);
    redis.set.mockResolvedValueOnce(null).mockResolvedValueOnce("OK"); // first deduped, second not
    await processor.process({ name: "check-expiring" } as any);
    expect(gateway.emitToShop).toHaveBeenCalledTimes(1);
    expect(gateway.emitToShop).toHaveBeenCalledWith(
      "shop-1",
      "license:expiring",
      expect.objectContaining({ licenseId: "license-4" }),
    );
  });
});
