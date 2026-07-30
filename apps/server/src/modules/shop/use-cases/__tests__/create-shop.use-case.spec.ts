import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { CreateShopUseCase } from "../create-shop.use-case";

describe("CreateShopUseCase", () => {
  let shopRepository: {
    existsByNameForOwner: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let userRepository: { findById: ReturnType<typeof vi.fn> };
  let useCase: CreateShopUseCase;

  const input = {
    requesterId: "owner-1",
    name: "Main Branch",
    address: { street: "123 Main St", city: "Colombo" },
    phone: "+94771234567",
  };

  beforeEach(() => {
    shopRepository = { existsByNameForOwner: vi.fn(), create: vi.fn() };
    userRepository = { findById: vi.fn() };
    useCase = new CreateShopUseCase(shopRepository as any, userRepository as any);

    userRepository.findById.mockResolvedValue(buildUser({ id: "owner-1", role: UserRole.OWNER }));
    shopRepository.existsByNameForOwner.mockResolvedValue(false);
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

  it("throws ConflictError when the requester already has a shop with this name", async () => {
    shopRepository.existsByNameForOwner.mockResolvedValue(true);
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("checks name uniqueness scoped to the requester as owner", async () => {
    await useCase.execute(input);
    expect(shopRepository.existsByNameForOwner).toHaveBeenCalledWith("Main Branch", "owner-1");
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

  it("does not query name uniqueness before confirming the requester is an OWNER", async () => {
    userRepository.findById.mockResolvedValue(buildUser({ role: UserRole.STAFF }));
    await expect(useCase.execute(input)).rejects.toThrow(AuthorizationError);
    expect(shopRepository.existsByNameForOwner).not.toHaveBeenCalled();
  });
});
