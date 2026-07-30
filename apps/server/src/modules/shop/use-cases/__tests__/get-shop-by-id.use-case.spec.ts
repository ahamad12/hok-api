import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { GetShopByIdUseCase } from "../get-shop-by-id.use-case";

describe("GetShopByIdUseCase", () => {
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let useCase: GetShopByIdUseCase;

  beforeEach(() => {
    shopRepository = { findById: vi.fn() };
    useCase = new GetShopByIdUseCase(shopRepository as any);
  });

  it("throws NotFoundError when no shop matches the id", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ shopId: "missing" })).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the shop exists but is soft-deleted (isActive: false)", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ isActive: false }));
    await expect(useCase.execute({ shopId: "shop-1" })).rejects.toThrow(NotFoundError);
  });

  it("returns the mapped shop when active", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-1", isActive: true }));
    const result = await useCase.execute({ shopId: "shop-1" });
    expect(result.id).toBe("shop-1");
  });
});
