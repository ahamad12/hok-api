import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { UserRole } from "@tapt-api/db";
import { describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { FormValidationError } from "../../../../common/errors/form-validation.error";
import { SubmitFormUseCase } from "../submit-form.use-case";

const activeForm = {
  id: "form-1",
  shopId: "shop-1",
  isActive: true,
  schema: [{ type: "text", name: "note", label: "Note", required: true }],
};

function setup() {
  const formRepo = { findByIdOrThrow: vi.fn() };
  const submissionRepo = { create: vi.fn() };
  const events = { emit: vi.fn() };
  const useCase = new SubmitFormUseCase(formRepo as any, submissionRepo as any, events as any);
  return { useCase, formRepo, submissionRepo, events };
}

describe("SubmitFormUseCase", () => {
  const staffSameShop = { userId: "u1", role: UserRole.STAFF, shopId: "shop-1" };
  const staffOtherShop = { userId: "u2", role: UserRole.STAFF, shopId: "shop-2" };
  const owner = { userId: "u3", role: UserRole.OWNER, shopId: "shop-999" };

  it("throws BusinessRuleError when the form is inactive", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ ...activeForm, isActive: false });
    await expect(useCase.execute(staffSameShop as any, "form-1", { note: "x" })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws AuthorizationError for STAFF submitting outside their shop", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue(activeForm);
    await expect(useCase.execute(staffOtherShop as any, "form-1", { note: "x" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows OWNER/MANAGER to submit regardless of shop", async () => {
    const { useCase, formRepo, submissionRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue(activeForm);
    submissionRepo.create.mockResolvedValue({ id: "sub-1" });
    await expect(useCase.execute(owner as any, "form-1", { note: "x" })).resolves.toEqual({
      id: "sub-1",
    });
  });

  it("throws FormValidationError (not BusinessRuleError) when answers fail schema validation", async () => {
    const { useCase, formRepo, submissionRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue(activeForm);
    await expect(useCase.execute(staffSameShop as any, "form-1", {})).rejects.toThrow(
      FormValidationError,
    );
    expect(submissionRepo.create).not.toHaveBeenCalled();
  });

  it("carries per-field errors on the thrown FormValidationError", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue(activeForm);
    try {
      await useCase.execute(staffSameShop as any, "form-1", {});
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(FormValidationError);
      expect((err as FormValidationError).errors).toEqual([
        { field: "note", message: "Note is required" },
      ]);
    }
  });

  it("creates the submission with staffId from the requester, not the payload", async () => {
    const { useCase, formRepo, submissionRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue(activeForm);
    submissionRepo.create.mockResolvedValue({ id: "sub-1" });

    await useCase.execute(staffSameShop as any, "form-1", { note: "all good" });

    expect(submissionRepo.create).toHaveBeenCalledWith({
      formId: "form-1",
      staffId: "u1",
      answers: { note: "all good" },
    });
  });

  it("emits FORM_SUBMITTED with shopId sourced from the form, not the requester", async () => {
    const { useCase, formRepo, submissionRepo, events } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue(activeForm);
    submissionRepo.create.mockResolvedValue({ id: "sub-1" });

    await useCase.execute(staffSameShop as any, "form-1", { note: "all good" });

    expect(events.emit).toHaveBeenCalledWith(SOCKET_EVENTS.FORM_SUBMITTED, {
      formId: "form-1",
      shopId: "shop-1",
      submissionId: "sub-1",
      staffId: "u1",
    });
  });

  it("does not emit when validation fails", async () => {
    const { useCase, formRepo, events } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue(activeForm);
    await expect(useCase.execute(staffSameShop as any, "form-1", {})).rejects.toThrow();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
