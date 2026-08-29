import { describe, expect, it, vi } from "vitest";
import { FormSubmissionRepository } from "../form-submission.repository";

function setup() {
  const prisma = {
    formSubmission: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const repo = new FormSubmissionRepository(prisma as any);
  return { repo, prisma };
}

describe("FormSubmissionRepository", () => {
  it("create casts answers to Prisma.InputJsonValue at the boundary", async () => {
    const { repo, prisma } = setup();
    const answers = { note: "hello", count: 3 };
    prisma.formSubmission.create.mockResolvedValue({ id: "sub-1" });

    await repo.create({ formId: "form-1", staffId: "staff-1", answers });

    expect(prisma.formSubmission.create).toHaveBeenCalledWith({
      data: { formId: "form-1", staffId: "staff-1", answers },
    });
  });

  it("findAll uses a single $transaction for findMany + count with matching where", async () => {
    const { repo, prisma } = setup();
    prisma.$transaction.mockResolvedValue([[{ id: "sub-1" }], 1]);

    const result = await repo.findAll({ formId: "form-1", limit: 20, offset: 0 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ submissions: [{ id: "sub-1" }], total: 1 });
  });

  it("findAll scopes by staffId only when provided", async () => {
    const { repo, prisma } = setup();
    prisma.$transaction.mockImplementation(async () => [[], 0]);

    await repo.findAll({ formId: "form-1", staffId: "staff-1", limit: 20, offset: 0 });
    await repo.findAll({ formId: "form-1", limit: 20, offset: 0 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
