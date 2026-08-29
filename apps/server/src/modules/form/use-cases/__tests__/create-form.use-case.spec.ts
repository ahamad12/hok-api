import type { FormField } from "@tapt-api/api/contracts/form.contract";
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { CreateFormUseCase } from "../create-form.use-case";

const staffField: FormField = { type: "text", name: "note", label: "Note", required: true };

function setup() {
  const formRepo = { create: vi.fn() };
  const shopRepo = { findById: vi.fn() };
  const useCase = new CreateFormUseCase(formRepo as any, shopRepo as any);
  return { useCase, formRepo, shopRepo };
}

describe("CreateFormUseCase", () => {
  const requesterOwner = { userId: "u1", role: UserRole.OWNER, shopId: "shop-1" };
  const requesterStaff = { userId: "u2", role: UserRole.STAFF, shopId: "shop-1" };

  it("throws AuthorizationError for STAFF", async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute(requesterStaff as any, {
        shopId: "shop-1",
        title: "T",
        schema: [staffField],
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError when shop is missing", async () => {
    const { useCase, shopRepo } = setup();
    shopRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute(requesterOwner as any, {
        shopId: "shop-1",
        title: "T",
        schema: [staffField],
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when shop is inactive", async () => {
    const { useCase, shopRepo } = setup();
    shopRepo.findById.mockResolvedValue({ id: "shop-1", isActive: false });
    await expect(
      useCase.execute(requesterOwner as any, {
        shopId: "shop-1",
        title: "T",
        schema: [staffField],
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError on duplicate field names", async () => {
    const { useCase, shopRepo } = setup();
    shopRepo.findById.mockResolvedValue({ id: "shop-1", isActive: true });
    await expect(
      useCase.execute(requesterOwner as any, {
        shopId: "shop-1",
        title: "T",
        schema: [staffField, staffField],
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("creates the form with isActive:true and description defaulted to null", async () => {
    const { useCase, shopRepo, formRepo } = setup();
    shopRepo.findById.mockResolvedValue({ id: "shop-1", isActive: true });
    formRepo.create.mockResolvedValue({ id: "form-1" });

    const result = await useCase.execute(requesterOwner as any, {
      shopId: "shop-1",
      title: "Opening checklist",
      schema: [staffField],
    });

    expect(formRepo.create).toHaveBeenCalledWith({
      shopId: "shop-1",
      title: "Opening checklist",
      description: null,
      schema: [staffField],
      isActive: true,
    });
    expect(result).toEqual({ id: "form-1" });
  });

  it("allows MANAGER (not just OWNER)", async () => {
    const { useCase, shopRepo, formRepo } = setup();
    shopRepo.findById.mockResolvedValue({ id: "shop-1", isActive: true });
    formRepo.create.mockResolvedValue({ id: "form-2" });
    await expect(
      useCase.execute({ userId: "u3", role: UserRole.MANAGER, shopId: "shop-1" } as any, {
        shopId: "shop-1",
        title: "T",
        schema: [staffField],
      }),
    ).resolves.toBeDefined();
    expect(formRepo.create).toHaveBeenCalled();
  });
});
