import type { FormField } from "@tapt-api/api/contracts/form.contract";
import { UserRole } from "@tapt-api/db";
import { describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { UpdateFormUseCase } from "../update-form.use-case";

function setup() {
  const formRepo = { findByIdOrThrow: vi.fn(), update: vi.fn() };
  const useCase = new UpdateFormUseCase(formRepo as any);
  return { useCase, formRepo };
}

const requesterOwner = { userId: "u1", role: UserRole.OWNER, shopId: "shop-1" };
const requesterStaff = { userId: "u2", role: UserRole.STAFF, shopId: "shop-1" };

describe("UpdateFormUseCase", () => {
  it("throws AuthorizationError for STAFF", async () => {
    const { useCase } = setup();
    await expect(useCase.execute(requesterStaff as any, "form-1", {})).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("propagates NotFoundError from findByIdOrThrow before writing", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockRejectedValue(new Error("not found"));
    await expect(useCase.execute(requesterOwner as any, "missing", {})).rejects.toThrow();
    expect(formRepo.update).not.toHaveBeenCalled();
  });

  it("throws BusinessRuleError on duplicate names in a schema update", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1" });
    const dup: FormField = { type: "text", name: "a", label: "A", required: false };
    await expect(
      useCase.execute(requesterOwner as any, "form-1", { schema: [dup, dup] }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("updates with provided fields, passing undefined through for omitted ones", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1" });
    formRepo.update.mockResolvedValue({ id: "form-1", title: "New title" });

    const result = await useCase.execute(requesterOwner as any, "form-1", {
      title: "New title",
    });

    expect(formRepo.update).toHaveBeenCalledWith("form-1", {
      title: "New title",
      description: undefined,
      schema: undefined,
      isActive: undefined,
    });
    expect(result).toEqual({ id: "form-1", title: "New title" });
  });

  it("allows isActive:false to deactivate without touching schema", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1" });
    formRepo.update.mockResolvedValue({ id: "form-1", isActive: false });
    await useCase.execute(requesterOwner as any, "form-1", { isActive: false });
    expect(formRepo.update).toHaveBeenCalledWith(
      "form-1",
      expect.objectContaining({ isActive: false }),
    );
  });
});
