import type { Form, FormSubmission } from "@tapt-api/db";

export type FormResult = Pick<
  Form,
  "id" | "shopId" | "title" | "description" | "schema" | "isActive" | "createdAt" | "updatedAt"
>;

export function toFormResult(form: Form): FormResult {
  const { id, shopId, title, description, schema, isActive, createdAt, updatedAt } = form;
  return { id, shopId, title, description, schema, isActive, createdAt, updatedAt };
}

export function toFormResults(forms: Form[]): FormResult[] {
  return forms.map(toFormResult);
}

export type FormSubmissionResult = Pick<
  FormSubmission,
  "id" | "formId" | "staffId" | "answers" | "submittedAt"
>;

export function toFormSubmissionResult(submission: FormSubmission): FormSubmissionResult {
  const { id, formId, staffId, answers, submittedAt } = submission;
  return { id, formId, staffId, answers, submittedAt };
}

export function toFormSubmissionResults(submissions: FormSubmission[]): FormSubmissionResult[] {
  return submissions.map(toFormSubmissionResult);
}
