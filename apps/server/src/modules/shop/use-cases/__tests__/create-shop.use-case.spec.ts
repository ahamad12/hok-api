import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { CreateShopUseCase } from "../create-shop.use-case";

describe("CreateShopUseCase", () => {
  let shopRepository: {
    create: ReturnType<typeof vi.fn>;
  };
  let userRepository: { findById: ReturnType<typeof vi.fn> };
  let tenantShops: { invalidate: ReturnType<typeof vi.fn> };
  let useCase: CreateShopUseCase;

  const input = {
    requesterId: "owner-1",
    name: "Main Branch",
    address: { street: "123 Main St", city: "Colombo" },
    phone: "+94771234567",
  };

  beforeEach(() => {
    shopRepository = { create: vi.fn() };
    userRepository = { findById: vi.fn() };
    tenantShops = { invalidate: vi.fn().mockResolvedValue(undefined) };
    useCase = new CreateShopUseCase(
      shopRepository as any,
      userRepository as any,
      tenantShops as any,
    );

    userRepository.findById.mockResolvedValue(buildUser({ id: "owner-1", role: UserRole.OWNER }));
    shopRepository.create.mockResolvedValue(buildShop({ ownerId: "owner-1" }));
  });

  it("throws NotFoundError when the requester does not exist", async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when the requester is a MANAGER, not an OWNER", async () => {
    userRepository.findById.mockResolvedValue(buildUser({ role: UserRole.MANAGER }));
    await expect(useCase.execute(input)).rejects.toThrow(AuthorizationError);
  });

  it("throws AuthorizationError when the requester is STAFF", async () => {
    userRepository.findById.mockResolvedValue(buildUser({ role: UserRole.STAFF }));
    await expect(useCase.execute(input)).rejects.toThrow(AuthorizationError);
  });

  it("does not pre-check name uniqueness before creating — goes straight to create", async () => {
    await useCase.execute(input);
    expect(shopRepository.create).toHaveBeenCalledTimes(1);
  });

  it("propagates a ConflictError thrown by the repository unchanged", async () => {
    shopRepository.create.mockRejectedValue(
      new ConflictError("You already have a shop with this name"),
    );
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("rethrows non-P2002 errors from create", async () => {
    const error = new Error("database down");
    shopRepository.create.mockRejectedValue(error);
    await expect(useCase.execute(input)).rejects.toThrow(error);
  });

  it("creates the shop with ownerId set to the requester and isActive true", async () => {
    await useCase.execute(input);
    expect(shopRepository.create).toHaveBeenCalledWith({
      name: input.name,
      address: input.address,
      phone: input.phone,
      ownerId: "owner-1",
      isActive: true,
    });
  });

  it("returns the created shop mapped through toShopResult", async () => {
    const created = buildShop({ ownerId: "owner-1", name: "Main Branch" });
    shopRepository.create.mockResolvedValue(created);
    const result = await useCase.execute(input);
    expect(result.shop.name).toBe("Main Branch");
    expect(result.shop.ownerId).toBe("owner-1");
  });

  it("refreshes the owner's cached tenant shop list so the new shop is reachable at once", async () => {
    await useCase.execute({
      requesterId: "owner-1",
      name: "New Shop",
      address: { street: "1 Main", city: "X", state: "Y", zip: "1", country: "Z" } as any,
      phone: "123",
    });
    expect(tenantShops.invalidate).toHaveBeenCalledWith("owner-1");
  });
});
