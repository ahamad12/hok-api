// apps/server/src/modules/expense/use-cases/get-expenses.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ExpenseRepository } from "../repositories/expense.repository";

@Injectable()
export class GetExpensesUseCase {
  constructor(private readonly expenseRepo: ExpenseRepository) {}

  async execute(
    requester: RequestUser,
    query: {
      shopId: string;
      categoryId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      includeVoided?: boolean;
      limit: number;
      offset: number;
    },
  ) {
    // Deliberate divergence from TillEntry/Delivery precedent (which scope
    // STAFF to their own shop rather than excluding them): expenses are
    // owner/manager financial bookkeeping, not a floor-operation record
    // staff have a reason to see. This is a flat exclusion by design, not
    // an oversight — do not "fix" this to match till/delivery's scoped
    // pattern without a product decision to reverse it.
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can view expenses");
    }
    return this.expenseRepo.findAll(query);
  }
}
