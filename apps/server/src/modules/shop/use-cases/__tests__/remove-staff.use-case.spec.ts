import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { RemoveStaffUseCase } from "../remove-staff.use-case";

describe("RemoveStaffUseCase", () => {
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let userRepository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let tokenVersionService: { invalidateSessions: ReturnType<typeof vi.fn> };
  let useCase: RemoveStaffUseCase;

  const input = { requesterId: "owner-1", shopId: "shop-1", userId: "staff-1" };

  beforeEach(() => {
    shopRepository = {
      findById: vi.fn().mockResolvedValue({ id: "shop-1", isActive: true, ownerId: "owner-1" }),
    };
    userRepository = { findById: vi.fn(), update: vi.fn() };
    tokenVersionService = { invalidateSessions: vi.fn().mockResolvedValue(1) };
    useCase = new RemoveStaffUseCase(
      shopRepository as any,
      userRepository as any,
      tokenVersionService as any,
    );

    userRepository.findById.mockImplementation(async (id: string) => {
      if (id === "owner-1") return buildUser({ id: "owner-1", role: UserRole.OWNER });
      if (id === "staff-1") {
        return buildUser({
          id: "staff-1",
          role: UserRole.STAFF,
          shopId: "shop-1",
          isSupervisor: true,
        });
      }
      return null;
    });
    userRepository.update.mockResolvedValue(
      buildUser({ id: "staff-1", shopId: null, isSupervisor: false }),
    );
  });

  it("throws AuthorizationError when the requester is neither OWNER nor MANAGER", async () => {
    userRepository.findById.mockImplementation(async (id: string) =>
      id === "owner-1" ? buildUser({ id: "owner-1", role: UserRole.STAFF }) : null,
    );
    await expect(useCase.execute(input)).rejects.toThrow(AuthorizationError);
  });

  it("allows a MANAGER requester to remove staff", async () => {
    userRepository.findById.mockImplementation(async (id: string) => {
      if (id === "owner-1")
        return buildUser({ id: "owner-1", role: UserRole.MANAGER, shopId: "shop-1" });
      if (id === "staff-1")
        return buildUser({ id: "staff-1", role: UserRole.STAFF, shopId: "shop-1" });
      return null;
    });
    await expect(useCase.execute(input)).resolves.toBeDefined();
  });

  it("throws AuthorizationError when a MANAGER from another business tries to remove staff", async () => {
    userRepository.findById.mockImplementation(async (id: string) => {
      if (id === "owner-1")
        return buildUser({
          id: "owner-1",
          role: UserRole.MANAGER,
          shopId: null,
          ownerId: "another-owner",
        });
      if (id === "staff-1")
        return buildUser({ id: "staff-1", role: UserRole.STAFF, shopId: "shop-1" });
      return null;
    });
    await expect(useCase.execute(input)).rejects.toThrow(AuthorizationError);
  });

  it("throws NotFoundError when the target user does not exist", async () => {
    userRepository.findById.mockImplementation(async (id: string) =>
      id === "owner-1" ? buildUser({ id: "owner-1", role: UserRole.OWNER }) : null,
    );
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the target user belongs to a DIFFERENT shop than the one specified", async () => {
    userRepository.findById.mockImplementation(async (id: string) => {
      if (id === "owner-1") return buildUser({ id: "owner-1", role: UserRole.OWNER });
      if (id === "staff-1")
        return buildUser({ id: "staff-1", role: UserRole.STAFF, shopId: "a-different-shop" });
      return null;
    });
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("clears both shopId AND isSupervisor together (invariant: supervisor requires a shop)", async () => {
    await useCase.execute(input);
    expect(userRepository.update).toHaveBeenCalledWith("staff-1", {
      shopId: null,
      isSupervisor: false,
    });
  });

  it("invalidates the removed staff member sessions", async () => {
    await useCase.execute(input);
    expect(tokenVersionService.invalidateSessions).toHaveBeenCalledWith("staff-1");
  });

  it("returns a success message", async () => {
    const result = await useCase.execute(input);
    expect(result).toEqual({ message: "Staff member removed from shop" });
  });

  it("does not call update or invalidateSessions when authorization fails", async () => {
    userRepository.findById.mockImplementation(async (id: string) =>
      id === "owner-1" ? buildUser({ id: "owner-1", role: UserRole.STAFF }) : null,
    );
    await expect(useCase.execute(input)).rejects.toThrow();
    expect(userRepository.update).not.toHaveBeenCalled();
    expect(tokenVersionService.invalidateSessions).not.toHaveBeenCalled();
  });
});
