// modules/till-entry/use-cases/__tests__/get-till-entry-by-id.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildTillEntry } from "../../../../test/fixtures/till-entry.fixture";
import { GetTillEntryByIdUseCase } from "../get-till-entry-by-id.use-case";

describe("GetTillEntryByIdUseCase", () => {
  let repo: { findById: ReturnType<typeof vi.fn> };
  let useCase: GetTillEntryByIdUseCase;

  beforeEach(() => {
    repo = { findById: vi.fn() };
    useCase = new GetTillEntryByIdUseCase(repo as any);
  });

  it("throws NotFoundError when missing", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ requesterRole: UserRole.OWNER, requesterShopId: null, entryId: "x" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError for STAFF on a different shop", async () => {
    repo.findById.mockResolvedValue(buildTillEntry({ shopId: "shop-1" }));
    await expect(
      useCase.execute({ requesterRole: UserRole.STAFF, requesterShopId: "shop-2", entryId: "e" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF on their own shop", async () => {
    repo.findById.mockResolvedValue(buildTillEntry({ shopId: "shop-1" }));
    await expect(
      useCase.execute({ requesterRole: UserRole.STAFF, requesterShopId: "shop-1", entryId: "e" }),
    ).resolves.toBeDefined();
  });

  it("allows OWNER/MANAGER regardless of shop", async () => {
    repo.findById.mockResolvedValue(buildTillEntry({ shopId: "shop-1" }));
    await expect(
      useCase.execute({ requesterRole: UserRole.OWNER, requesterShopId: null, entryId: "e" }),
    ).resolves.toBeDefined();
  });
});
