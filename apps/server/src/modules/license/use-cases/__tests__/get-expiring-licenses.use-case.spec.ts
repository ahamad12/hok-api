import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { GetExpiringLicensesUseCase } from "../get-expiring-licenses.use-case";

describe("GetExpiringLicensesUseCase", () => {
  let licenseRepository: { findCandidatesForReminder: ReturnType<typeof vi.fn> };
  let useCase: GetExpiringLicensesUseCase;

  beforeEach(() => {
    licenseRepository = { findCandidatesForReminder: vi.fn().mockResolvedValue([]) };
    useCase = new GetExpiringLicensesUseCase(licenseRepository as any);
  });

  it("throws AuthorizationError when STAFF requests a different shop's dashboard", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "other-shop",
        shopId: "shop-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("calls the repository scoped to the requested shop, not all shops", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      shopId: "shop-1",
    });
    const [, shopIdArg] = licenseRepository.findCandidatesForReminder.mock.calls[0]!;
    expect(shopIdArg).toBe("shop-1");
  });

  it("filters candidates down to only those actually inside their remindDays window", async () => {
    licenseRepository.findCandidatesForReminder.mockResolvedValue([
      buildLicense({
        id: "soon",
        remindDays: 7,
        currentExpiryDate: new Date(Date.now() + 3 * 86_400_000),
      }),
      buildLicense({
        id: "far",
        remindDays: 7,
        currentExpiryDate: new Date(Date.now() + 60 * 86_400_000),
      }),
    ]);
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      shopId: "shop-1",
    });
    expect(result.licenses.map((l) => l.id)).toEqual(["soon"]);
  });
});
