import type { FormField } from "@tapt-api/api/contracts/form.contract";
import { describe, expect, it } from "vitest";
import { validateAnswersAgainstSchema } from "../form-answer-validation";

const field = <T extends FormField>(f: T) => f;

describe("validateAnswersAgainstSchema", () => {
  it("returns no errors for an empty schema and empty answers", () => {
    expect(validateAnswersAgainstSchema([], {})).toEqual([]);
  });

  describe("required", () => {
    const fields: FormField[] = [
      field({ type: "text", name: "note", label: "Note", required: true }),
    ];

    it("errors when a required field is missing", () => {
      const errors = validateAnswersAgainstSchema(fields, {});
      expect(errors).toEqual([{ field: "note", message: "Note is required" }]);
    });

    it("errors when a required field is empty string", () => {
      const errors = validateAnswersAgainstSchema(fields, { note: "" });
      expect(errors).toHaveLength(1);
    });

    it("errors when a required field is null", () => {
      const errors = validateAnswersAgainstSchema(fields, { note: null });
      expect(errors).toHaveLength(1);
    });

    it("skips type checks entirely on an optional missing field", () => {
      const optional: FormField[] = [
        field({ type: "number", name: "qty", label: "Qty", required: false }),
      ];
      expect(validateAnswersAgainstSchema(optional, {})).toEqual([]);
    });
  });

  describe("text / textarea", () => {
    const fields: FormField[] = [
      field({ type: "text", name: "t", label: "T", required: true, maxLength: 5 }),
    ];

    it("passes a valid string within maxLength", () => {
      expect(validateAnswersAgainstSchema(fields, { t: "abc" })).toEqual([]);
    });

    it("rejects a non-string value", () => {
      expect(validateAnswersAgainstSchema(fields, { t: 123 })).toEqual([
        { field: "t", message: "T must be text" },
      ]);
    });

    it("rejects a string exceeding maxLength", () => {
      expect(validateAnswersAgainstSchema(fields, { t: "toolong" })).toEqual([
        { field: "t", message: "T must be at most 5 characters" },
      ]);
    });
  });

  describe("number", () => {
    const fields: FormField[] = [
      field({ type: "number", name: "n", label: "N", required: true, min: 1, max: 10 }),
    ];

    it("passes a value within range", () => {
      expect(validateAnswersAgainstSchema(fields, { n: 5 })).toEqual([]);
    });

    it("rejects a non-number", () => {
      expect(validateAnswersAgainstSchema(fields, { n: "5" })).toEqual([
        { field: "n", message: "N must be a number" },
      ]);
    });

    it("rejects below min", () => {
      expect(validateAnswersAgainstSchema(fields, { n: 0 })).toEqual([
        { field: "n", message: "N must be at least 1" },
      ]);
    });

    it("rejects above max", () => {
      expect(validateAnswersAgainstSchema(fields, { n: 11 })).toEqual([
        { field: "n", message: "N must be at most 10" },
      ]);
    });
  });

  describe("email", () => {
    const fields: FormField[] = [field({ type: "email", name: "e", label: "E", required: true })];

    it("passes a valid email", () => {
      expect(validateAnswersAgainstSchema(fields, { e: "a@b.com" })).toEqual([]);
    });

    it("rejects an invalid email", () => {
      expect(validateAnswersAgainstSchema(fields, { e: "not-an-email" })).toEqual([
        { field: "e", message: "E must be a valid email" },
      ]);
    });
  });

  describe("date", () => {
    const fields: FormField[] = [field({ type: "date", name: "d", label: "D", required: true })];

    it("passes a parseable date string", () => {
      expect(validateAnswersAgainstSchema(fields, { d: "2026-08-30" })).toEqual([]);
    });

    it("rejects an unparseable string", () => {
      expect(validateAnswersAgainstSchema(fields, { d: "not-a-date" })).toEqual([
        { field: "d", message: "D must be a valid date" },
      ]);
    });
  });

  describe("select / radio", () => {
    const fields: FormField[] = [
      field({
        type: "select",
        name: "s",
        label: "S",
        required: true,
        options: ["a", "b"],
      }),
    ];

    it("passes a value in options", () => {
      expect(validateAnswersAgainstSchema(fields, { s: "a" })).toEqual([]);
    });

    it("rejects a value not in options", () => {
      expect(validateAnswersAgainstSchema(fields, { s: "c" })).toEqual([
        { field: "s", message: "S must be one of: a, b" },
      ]);
    });
  });

  describe("multiselect", () => {
    const fields: FormField[] = [
      field({
        type: "multiselect",
        name: "m",
        label: "M",
        required: true,
        options: ["a", "b", "c"],
      }),
    ];

    it("passes an array of valid options", () => {
      expect(validateAnswersAgainstSchema(fields, { m: ["a", "c"] })).toEqual([]);
    });

    it("rejects a non-array", () => {
      expect(validateAnswersAgainstSchema(fields, { m: "a" })).toEqual([
        { field: "m", message: "M must be a selection of: a, b, c" },
      ]);
    });

    it("rejects an array containing an invalid option", () => {
      expect(validateAnswersAgainstSchema(fields, { m: ["a", "x"] })).toEqual([
        { field: "m", message: "M must be a selection of: a, b, c" },
      ]);
    });
  });

  describe("checkbox", () => {
    const fields: FormField[] = [
      field({ type: "checkbox", name: "c", label: "C", required: true }),
    ];

    it("passes true", () => {
      expect(validateAnswersAgainstSchema(fields, { c: true })).toEqual([]);
    });

    it("passes false — note: required+false is NOT treated as empty", () => {
      expect(validateAnswersAgainstSchema(fields, { c: false })).toEqual([]);
    });

    it("rejects a non-boolean", () => {
      expect(validateAnswersAgainstSchema(fields, { c: "yes" })).toEqual([
        { field: "c", message: "C must be true or false" },
      ]);
    });
  });

  describe("file / image / signature", () => {
    it.each(["file", "image", "signature"] as const)("validates %s as an https URL", (type) => {
      const fields: FormField[] = [field({ type, name: "f", label: "F", required: true })];
      expect(validateAnswersAgainstSchema(fields, { f: "https://cdn.example.com/x.png" })).toEqual(
        [],
      );
      expect(validateAnswersAgainstSchema(fields, { f: "not-a-url" })).toEqual([
        { field: "f", message: "F must be a valid uploaded file URL" },
      ]);
    });
  });

  it("collects multiple errors across multiple fields in one pass", () => {
    const fields: FormField[] = [
      field({ type: "text", name: "a", label: "A", required: true }),
      field({ type: "number", name: "b", label: "B", required: true }),
    ];
    const errors = validateAnswersAgainstSchema(fields, { b: "not-a-number" });
    expect(errors).toEqual([
      { field: "a", message: "A is required" },
      { field: "b", message: "B must be a number" },
    ]);
  });
});
