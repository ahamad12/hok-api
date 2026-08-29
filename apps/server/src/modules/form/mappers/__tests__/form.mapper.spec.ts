// modules/form/mappers/__tests__/form.mapper.spec.ts

import type { Form, FormSubmission } from "@tapt-api/db";
import { describe, expect, it } from "vitest";
import {
  toFormResult,
  toFormResults,
  toFormSubmissionResult,
  toFormSubmissionResults,
} from "../form.mapper";

function buildForm(overrides: Partial<Form> = {}): Form {
  return {
    id: "form-1",
    shopId: "shop-1",
    title: "Opening checklist",
    description: "Daily opening tasks",
    schema: [
      { type: "text", name: "note", label: "Note", required: true },
    ] as unknown as Form["schema"],
    isActive: true,
    createdAt: new Date("2026-08-30T10:00:00.000Z"),
    updatedAt: new Date("2026-08-30T10:00:00.000Z"),
    ...overrides,
  } as Form;
}

function buildSubmission(overrides: Partial<FormSubmission> = {}): FormSubmission {
  return {
    id: "sub-1",
    formId: "form-1",
    staffId: "staff-1",
    answers: { note: "all good" } as unknown as FormSubmission["answers"],
    submittedAt: new Date("2026-08-30T11:00:00.000Z"),
    ...overrides,
  } as FormSubmission;
}

describe("toFormResult", () => {
  it("maps all whitelisted fields", () => {
    const form = buildForm();
    expect(toFormResult(form)).toEqual({
      id: form.id,
      shopId: form.shopId,
      title: form.title,
      description: form.description,
      schema: form.schema,
      isActive: form.isActive,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    });
  });

  it("does not leak fields beyond the whitelisted set", () => {
    const result = toFormResult(buildForm());
    expect(Object.keys(result).sort()).toEqual(
      [
        "createdAt",
        "description",
        "id",
        "isActive",
        "schema",
        "shopId",
        "title",
        "updatedAt",
      ].sort(),
    );
  });

  it("passes through a null description unchanged", () => {
    const result = toFormResult(buildForm({ description: null }));
    expect(result.description).toBeNull();
  });

  it("passes through isActive false unchanged", () => {
    const result = toFormResult(buildForm({ isActive: false }));
    expect(result.isActive).toBe(false);
  });

  it("passes through schema Json array unchanged (no transform)", () => {
    const schema = [
      { type: "text", name: "a", label: "A", required: true },
      { type: "number", name: "n", label: "N", required: false, min: 1 },
    ] as unknown as Form["schema"];
    const result = toFormResult(buildForm({ schema }));
    expect(result.schema).toEqual(schema);
  });
});

describe("toFormResults", () => {
  it("maps an array, preserving order", () => {
    const forms = [buildForm({ id: "f-1" }), buildForm({ id: "f-2" })];
    expect(toFormResults(forms).map((f) => f.id)).toEqual(["f-1", "f-2"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toFormResults([])).toEqual([]);
  });
});

describe("toFormSubmissionResult", () => {
  it("maps all whitelisted fields", () => {
    const sub = buildSubmission();
    expect(toFormSubmissionResult(sub)).toEqual({
      id: sub.id,
      formId: sub.formId,
      staffId: sub.staffId,
      answers: sub.answers,
      submittedAt: sub.submittedAt,
    });
  });

  it("does not leak fields beyond the whitelisted set", () => {
    const result = toFormSubmissionResult(buildSubmission());
    expect(Object.keys(result).sort()).toEqual(
      ["answers", "formId", "id", "staffId", "submittedAt"].sort(),
    );
  });

  it("passes through answers Json unchanged (no transform)", () => {
    const answers = {
      note: "hello",
      extra: 123,
      nested: { a: true },
    } as unknown as FormSubmission["answers"];
    const result = toFormSubmissionResult(buildSubmission({ answers }));
    expect(result.answers).toEqual(answers);
  });
});

describe("toFormSubmissionResults", () => {
  it("maps an array, preserving order", () => {
    const subs = [buildSubmission({ id: "s-1" }), buildSubmission({ id: "s-2" })];
    expect(toFormSubmissionResults(subs).map((s) => s.id)).toEqual(["s-1", "s-2"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toFormSubmissionResults([])).toEqual([]);
  });
});
