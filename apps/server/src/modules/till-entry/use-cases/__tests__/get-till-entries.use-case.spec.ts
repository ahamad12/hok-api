// modules/till-entry/use-cases/__tests__/get-till-entries.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildTillEntry } from "../../../../test/fixtures/till-entry.fixture";
import { GetTillEntriesUseCase } from "../get-till-entries.use-case";

describe("GetTillEntriesUseCase", () => {
  let repo: { findAll: ReturnType<typeof vi.fn> };
  let useCase: GetTillEntriesUseCase;
  const base = {
    requesterRole: UserRole.MANAGER,
    requesterShopId: null,
    shopId: "shop-1",
    limit: 50,
    offset: 0,
  };

  beforeEach(() => {
    repo = { findAll: vi.fn().mockResolvedValue({ entries: [], total: 0 }) };
    useCase = new GetTillEntriesUseCase(repo as any);
  });

  it("throws AuthorizationError for STAFF on a different shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF scoped to their own shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "shop-1" }),
    ).resolves.toBeDefined();
  });

  it("passes filters through to the repository unchanged", async () => {
    await useCase.execute({ ...base, category: "EXPENSE", dateFrom: new Date("2026-07-01") });
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ category: "EXPENSE", dateFrom: new Date("2026-07-01") }),
      { limit: 50, offset: 0 },
    );
  });

  it("maps every returned entry", async () => {
    repo.findAll.mockResolvedValue({
      entries: [buildTillEntry({ id: "a" }), buildTillEntry({ id: "b" })],
      total: 2,
    });
    const result = await useCase.execute(base);
    expect(result.entries.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
