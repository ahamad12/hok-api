import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { GetMyShopsUseCase } from "../get-my-shops.use-case";

describe("GetMyShopsUseCase", () => {
  let shopRepository: { findByOwner: ReturnType<typeof vi.fn> };
  let useCase: GetMyShopsUseCase;

  beforeEach(() => {
    shopRepository = { findByOwner: vi.fn() };
    useCase = new GetMyShopsUseCase(shopRepository as any);
  });

  it("delegates to shopRepository.findByOwner with the requesterId", async () => {
    shopRepository.findByOwner.mockResolvedValue([]);
    await useCase.execute({ requesterId: "owner-1" });
    expect(shopRepository.findByOwner).toHaveBeenCalledWith("owner-1");
  });

  it("returns an empty shops array when the owner has none", async () => {
    shopRepository.findByOwner.mockResolvedValue([]);
    const result = await useCase.execute({ requesterId: "owner-1" });
    expect(result).toEqual({ shops: [] });
  });

  it("maps every returned shop through toShopResult", async () => {
    shopRepository.findByOwner.mockResolvedValue([
      buildShop({ id: "shop-1" }),
      buildShop({ id: "shop-2" }),
    ]);
    const result = await useCase.execute({ requesterId: "owner-1" });
    expect(result.shops.map((s) => s.id)).toEqual(["shop-1", "shop-2"]);
  });
});
