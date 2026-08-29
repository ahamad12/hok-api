import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

// Shared building blocks so every field variant doesn't repeat name/label/required.
const baseField = {
  name: z.string().trim().min(1).max(50), // key used in answers map — must be unique per form, enforced below
  label: z.string().trim().min(1).max(150),
  required: z.boolean().default(false),
  helpText: z.string().trim().max(300).optional(),
};

const textField = z.object({
  type: z.literal("text"),
  ...baseField,
  placeholder: z.string().max(100).optional(),
  maxLength: z.number().int().positive().optional(),
});
const textareaField = z.object({
  type: z.literal("textarea"),
  ...baseField,
  placeholder: z.string().max(100).optional(),
  maxLength: z.number().int().positive().optional(),
});
const numberField = z.object({
  type: z.literal("number"),
  ...baseField,
  min: z.number().optional(),
  max: z.number().optional(),
});
const emailField = z.object({ type: z.literal("email"), ...baseField });
const dateField = z.object({ type: z.literal("date"), ...baseField });
const selectField = z.object({
  type: z.literal("select"),
  ...baseField,
  options: z.array(z.string().min(1)).min(1),
});
const multiselectField = z.object({
  type: z.literal("multiselect"),
  ...baseField,
  options: z.array(z.string().min(1)).min(1),
});
const radioField = z.object({
  type: z.literal("radio"),
  ...baseField,
  options: z.array(z.string().min(1)).min(2),
});
const checkboxField = z.object({ type: z.literal("checkbox"), ...baseField }); // single boolean, e.g. "I confirm..."
const fileField = z.object({
  type: z.literal("file"),
  ...baseField,
  accept: z.array(z.string()).optional(), // e.g. ["application/pdf"]
});
const imageField = z.object({ type: z.literal("image"), ...baseField });
const signatureField = z.object({ type: z.literal("signature"), ...baseField });

export const formFieldSchema = z.discriminatedUnion("type", [
  textField,
  textareaField,
  numberField,
  emailField,
  dateField,
  selectField,
  multiselectField,
  radioField,
  checkboxField,
  fileField,
  imageField,
  signatureField,
]);

export type FormField = z.infer<typeof formFieldSchema>;

// Enforce unique field names within one form's schema — two fields named
// "date" would silently collide as the same key in `answers`, and nobody
// would notice until a submission clobbers one field's value with another's.
const formFieldsSchema = z
  .array(formFieldSchema)
  .min(1, "A form must have at least one field")
  .refine((fields) => new Set(fields.map((f) => f.name)).size === fields.length, {
    message: "Field names must be unique within a form",
  });

const formSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  schema: z.array(formFieldSchema),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const formSubmissionSchema = z.object({
  id: z.string().uuid(),
  formId: z.string().uuid(),
  staffId: z.string().uuid(),
  answers: z.record(z.string(), z.any()),
  submittedAt: z.coerce.date(),
});

export const formContract = c.router(
  {
    create: {
      method: "POST",
      path: "/forms",
      body: z.object({
        shopId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(500).optional(),
        schema: formFieldsSchema,
      }),
      responses: { 201: formSchema },
    },
    getAll: {
      method: "GET",
      path: "/forms",
      query: z.object({
        shopId: z.string().uuid(),
        isActive: z.coerce.boolean().optional(),
      }),
      responses: { 200: z.object({ forms: z.array(formSchema) }) },
    },
    getById: {
      method: "GET",
      path: "/forms/:id",
      responses: { 200: formSchema },
    },
    update: {
      method: "PATCH",
      path: "/forms/:id",
      body: z
        .object({
          title: z.string().trim().min(1).max(200).optional(),
          description: z.string().trim().max(500).nullable().optional(),
          schema: formFieldsSchema.optional(),
          isActive: z.boolean().optional(),
        })
        .strict()
        .refine((v) => Object.keys(v).length > 0, {
          message: "At least one field must be provided",
        }),
      responses: { 200: formSchema },
    },
    submit: {
      method: "POST",
      path: "/forms/:id/submit",
      body: z.object({ answers: z.record(z.string(), z.any()) }),
      responses: {
        201: formSubmissionSchema,
        // Field-level validation failure — FormValidationError maps to this
        // exact shape in global-exception.filter.ts.
        422: z.object({
          code: z.literal("VALIDATION_ERROR"),
          errors: z.array(z.object({ field: z.string(), message: z.string() })),
        }),
      },
    },
    getSubmissions: {
      method: "GET",
      path: "/forms/:id/submissions",
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      responses: {
        200: z.object({ submissions: z.array(formSubmissionSchema), total: z.number() }),
      },
    },
  },
  { pathPrefix: "/api/v1" },
);
