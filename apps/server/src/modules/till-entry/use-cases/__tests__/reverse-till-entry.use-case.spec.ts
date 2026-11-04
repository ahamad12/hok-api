// modules/till-entry/use-cases/__tests__/reverse-till-entry.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildTillEntry } from "../../../../test/fixtures/till-entry.fixture";
import { ReverseTillEntryUseCase } from "../reverse-till-entry.use-case";

describe("ReverseTillEntryUseCase", () => {
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let useCase: ReverseTillEntryUseCase;
  const input = {
    requesterId: "mgr-1",
    requesterRole: UserRole.MANAGER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    entryId: "entry-1",
    correctionReason: "Wrong category",
  };

  beforeEach(() => {
    repo = { findById: vi.fn(), create: vi.fn() };
    useCase = new ReverseTillEntryUseCase(repo as any);
    repo.findById.mockResolvedValue(
      buildTillEntry({ id: "entry-1", shopId: "shop-1", amount: 5000, category: "EXPENSE" }),
    );
    repo.create.mockResolvedValue(
      buildTillEntry({ id: "entry-2", amount: -5000, reversesEntryId: "entry-1" }),
    );
  });

  it("throws NotFoundError when the original does not exist", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError for STAFF on a different shop", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.STAFF, requesterShopId: "other" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError when reversing an entry that is itself a reversal", async () => {
    repo.findById.mockResolvedValue(buildTillEntry({ id: "entry-2", reversesEntryId: "entry-1" }));
    await expect(useCase.execute({ ...input, entryId: "entry-2" })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("does not pre-check for an existing reversal — goes straight to create", async () => {
    await useCase.execute(input);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it("propagates a ConflictError thrown by the repository unchanged", async () => {
    repo.create.mockRejectedValue(new ConflictError("This entry has already been reversed"));
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("rethrows non-P2002 errors from create", async () => {
    const error = new Error("database down");
    repo.create.mockRejectedValue(error);
    await expect(useCase.execute(input)).rejects.toThrow(error);
  });

  it("creates the reversal with the amount NEGATED, not duplicated", async () => {
    await useCase.execute(input);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ amount: -5000 }));
  });

  it("preserves the original category on the reversal row", async () => {
    await useCase.execute(input);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ category: "EXPENSE" }));
  });

  it("links the reversal via reversesEntryId", async () => {
    await useCase.execute(input);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ reversesEntryId: "entry-1" }),
    );
  });

  it("records the requester (not the original recorder) as recordedById", async () => {
    await useCase.execute(input);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ recordedById: "mgr-1" }));
  });

  it("returns the mapped reversal", async () => {
    const result = await useCase.execute(input);
    expect(result.amount).toBe(-5000);
    expect(result.reversesEntryId).toBe("entry-1");
  });
});
