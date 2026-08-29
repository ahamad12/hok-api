import { Injectable } from "@nestjs/common";
import { type FormSubmission, PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

interface CreateFormSubmissionInput {
  formId: string;
  staffId: string;
  answers: Record<string, unknown>;
}

@Injectable()
export class FormSubmissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateFormSubmissionInput): Promise<FormSubmission> {
    // Cast lives here, not in the use-case — use-cases stay Prisma-free
    // (AGENTS.md:80, "Repository ONLY Prisma"). Safe because
    // validateAnswersAgainstSchema already guarantees `answers` is
    // JSON-serializable (string/number/boolean/array/URL string per field
    // type) before this is ever called — see submit-form.use-case.ts.
    return this.prisma.formSubmission.create({
      data: {
        formId: data.formId,
        staffId: data.staffId,
        answers: data.answers as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(params: {
    formId: string;
    staffId?: string;
    limit: number;
    offset: number;
  }): Promise<{ submissions: FormSubmission[]; total: number }> {
    const where: Prisma.FormSubmissionWhereInput = {
      formId: params.formId,
      ...(params.staffId ? { staffId: params.staffId } : {}),
    };

    const [submissions, total] = await this.prisma.$transaction([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);

    return { submissions, total };
  }
}
