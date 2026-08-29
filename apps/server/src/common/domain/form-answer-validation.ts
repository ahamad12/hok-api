// Pure domain function — the actual "does this submission satisfy this
// form's rules" check. Zod at the contract layer only knows `answers` is a
// map of strings to anything; it has no idea what THIS form requires. No
// Prisma import here on purpose — this is testable without a database.

import type { FormField } from "@tapt-api/api/contracts/form.contract";

export interface FieldValidationError {
  field: string;
  message: string;
}

export function validateAnswersAgainstSchema(
  fields: FormField[],
  answers: Record<string, unknown>,
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  for (const field of fields) {
    const value = answers[field.name];
    const isEmpty = value === undefined || value === null || value === "";

    if (field.required && isEmpty) {
      errors.push({ field: field.name, message: `${field.label} is required` });
      continue; // no further checks make sense on a missing required value
    }

    if (isEmpty) continue; // optional and not provided — nothing more to check

    switch (field.type) {
      case "text":
      case "textarea":
        if (typeof value !== "string") {
          errors.push({ field: field.name, message: `${field.label} must be text` });
        } else if (field.maxLength && value.length > field.maxLength) {
          errors.push({
            field: field.name,
            message: `${field.label} must be at most ${field.maxLength} characters`,
          });
        }
        break;

      case "number":
        if (typeof value !== "number") {
          errors.push({ field: field.name, message: `${field.label} must be a number` });
        } else {
          if (field.min !== undefined && value < field.min) {
            errors.push({
              field: field.name,
              message: `${field.label} must be at least ${field.min}`,
            });
          }
          if (field.max !== undefined && value > field.max) {
            errors.push({
              field: field.name,
              message: `${field.label} must be at most ${field.max}`,
            });
          }
        }
        break;

      case "email":
        if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({ field: field.name, message: `${field.label} must be a valid email` });
        }
        break;

      case "date":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
          errors.push({ field: field.name, message: `${field.label} must be a valid date` });
        }
        break;

      case "select":
      case "radio":
        if (typeof value !== "string" || !field.options.includes(value)) {
          errors.push({
            field: field.name,
            message: `${field.label} must be one of: ${field.options.join(", ")}`,
          });
        }
        break;

      case "multiselect":
        if (
          !Array.isArray(value) ||
          !value.every((v) => typeof v === "string" && field.options.includes(v))
        ) {
          errors.push({
            field: field.name,
            message: `${field.label} must be a selection of: ${field.options.join(", ")}`,
          });
        }
        break;

      case "checkbox":
        if (typeof value !== "boolean") {
          errors.push({ field: field.name, message: `${field.label} must be true or false` });
        }
        break;

      case "file":
      case "image":
      case "signature":
        // These arrive as a Cloudinary URL string, already uploaded client-side
        // before the form submission is sent — this use-case never touches
        // StorageService directly, it only checks the shape of what came back.
        if (typeof value !== "string" || !/^https?:\/\//.test(value)) {
          errors.push({
            field: field.name,
            message: `${field.label} must be a valid uploaded file URL`,
          });
        }
        break;
    }
  }

  return errors;
}
