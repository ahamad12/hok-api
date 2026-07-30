import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { GetShopStaffUseCase } from "../get-shop-staff.use-case";

describe("GetShopStaffUseCase", () => {
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let userRepository: { findByShop: ReturnType<typeof vi.fn> };
  let useCase: GetShopStaffUseCase;

  beforeEach(() => {
    shopRepository = { findById: vi.fn() };
    userRepository = { findByShop: vi.fn() };
    useCase = new GetShopStaffUseCase(shopRepository as any, userRepository as any);
  });

  it("throws NotFoundError when the shop does not exist", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ shopId: "missing" })).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the shop is soft-deleted", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ isActive: false }));
    await expect(useCase.execute({ shopId: "shop-1" })).rejects.toThrow(NotFoundError);
  });

  it("returns an empty staff list for a shop with no assigned staff", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ isActive: true }));
    userRepository.findByShop.mockResolvedValue([]);
    const result = await useCase.execute({ shopId: "shop-1" });
    expect(result).toEqual({ staff: [] });
  });

  it("maps each staff member to a StaffSummary shape (no passwordHash leaked)", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ isActive: true }));
    userRepository.findByShop.mockResolvedValue([
      buildUser({ id: "staff-1", role: UserRole.STAFF, isSupervisor: true }),
    ]);

    const result = await useCase.execute({ shopId: "shop-1" });

    expect(result.staff[0]).toEqual({
      id: "staff-1",
      email: "staff@shop.test",
      displayName: "Staff User",
      role: UserRole.STAFF,
      isSupervisor: true,
      isActive: true,
    });
    expect(result.staff[0]).not.toHaveProperty("passwordHash");
  });

  it("queries staff scoped to the given shopId", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ isActive: true }));
    userRepository.findByShop.mockResolvedValue([]);
    await useCase.execute({ shopId: "shop-42" });
    expect(userRepository.findByShop).toHaveBeenCalledWith("shop-42");
  });
});
