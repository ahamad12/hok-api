import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { AssignStaffUseCase } from "../assign-staff.use-case";

describe("AssignStaffUseCase", () => {
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let userRepository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let tokenVersionService: { invalidateSessions: ReturnType<typeof vi.fn> };
  let useCase: AssignStaffUseCase;

  const input = { requesterId: "owner-1", shopId: "shop-1", userId: "staff-1" };

  beforeEach(() => {
    shopRepository = { findById: vi.fn() };
    userRepository = { findById: vi.fn(), update: vi.fn() };
    tokenVersionService = { invalidateSessions: vi.fn().mockResolvedValue(1) };
    useCase = new AssignStaffUseCase(
      shopRepository as any,
      userRepository as any,
      tokenVersionService as any,
    );

    shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-1", isActive: true }));
    userRepository.findById.mockImplementation(async (id: string) => {
      if (id === "owner-1") return buildUser({ id: "owner-1", role: UserRole.OWNER });
      if (id === "staff-1") return buildUser({ id: "staff-1", role: UserRole.STAFF, shopId: null });
      return null;
    });
    userRepository.update.mockResolvedValue(buildUser({ id: "staff-1", shopId: "shop-1" }));
  });

  it("throws NotFoundError when the shop does not exist", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the shop is soft-deleted", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ isActive: false }));
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the target user does not exist", async () => {
    userRepository.findById.mockImplementation(async (id: string) =>
      id === "owner-1" ? buildUser({ id: "owner-1", role: UserRole.OWNER }) : null,
    );
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when the requester is neither OWNER nor MANAGER", async () => {
    userRepository.findById.mockImplementation(async (id: string) => {
      if (id === "owner-1") return buildUser({ id: "owner-1", role: UserRole.STAFF });
      if (id === "staff-1") return buildUser({ id: "staff-1", role: UserRole.STAFF, shopId: null });
      return null;
    });
    await expect(useCase.execute(input)).rejects.toThrow(AuthorizationError);
  });

  it("allows a MANAGER requester (not just OWNER) to assign staff", async () => {
    userRepository.findById.mockImplementation(async (id: string) => {
      if (id === "owner-1") return buildUser({ id: "owner-1", role: UserRole.MANAGER });
      if (id === "staff-1") return buildUser({ id: "staff-1", role: UserRole.STAFF, shopId: null });
      return null;
    });
    await expect(useCase.execute(input)).resolves.toBeDefined();
  });

  it("throws BusinessRuleError when the target user is not STAFF (e.g. attempting to assign a MANAGER)", async () => {
    userRepository.findById.mockImplementation(async (id: string) => {
      if (id === "owner-1") return buildUser({ id: "owner-1", role: UserRole.OWNER });
      if (id === "staff-1") return buildUser({ id: "staff-1", role: UserRole.MANAGER });
      return null;
    });
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("updates the target user shopId to the given shop", async () => {
    await useCase.execute(input);
    expect(userRepository.update).toHaveBeenCalledWith("staff-1", { shopId: "shop-1" });
  });

  it("invalidates the target user sessions after reassignment (JWT shopId claim is now stale)", async () => {
    await useCase.execute(input);
    expect(tokenVersionService.invalidateSessions).toHaveBeenCalledWith("staff-1");
  });

  it("does not touch the requester tokenVersion, only the target user", async () => {
    await useCase.execute(input);
    expect(tokenVersionService.invalidateSessions).not.toHaveBeenCalledWith("owner-1");
  });

  it("returns a StaffSummary for the updated user", async () => {
    userRepository.update.mockResolvedValue(
      buildUser({ id: "staff-1", shopId: "shop-1", isSupervisor: false, isActive: true }),
    );
    const result = await useCase.execute(input);
    expect(result).toMatchObject({ id: "staff-1", role: UserRole.STAFF, isSupervisor: false });
  });
});
