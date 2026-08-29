// apps/server/src/common/errors/form-validation.error.ts
export class FormValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "FormValidationError";
  }
}
