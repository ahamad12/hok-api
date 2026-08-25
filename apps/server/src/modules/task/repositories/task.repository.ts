// apps/server/src/modules/task/repositories/task.repository.ts
import { Injectable } from "@nestjs/common";
import { PrismaService, type Task, TaskStatus } from "@tapt-api/db";
import { Prisma } from "@tapt-api/db/prisma";
import { ConflictError } from "../../../common/errors";
import { isUniqueViolation } from "../../../common/prisma/errors";

export interface TaskListFilters {
  shopId: string;
  status?: Task["status"];
  assigneeId?: string;
  isOverdue?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

export interface CreateTaskData {
  shopId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: Date | null;
  isRecurring: boolean;
  recurringConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  priority: number;
  createdById: string;
}

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTaskData): Promise<Task> {
    try {
      return await this.prisma.task.create({ data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A task with these attributes already exists");
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Task | null> {
    return this.prisma.task.findUnique({ where: { id } });
  }

  async findAll(filters: TaskListFilters): Promise<{ tasks: Task[]; total: number }> {
    const where = this.buildWhere(filters);

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: filters.limit,
        skip: filters.offset,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { tasks, total };
  }

  async update(id: string, data: Prisma.TaskUncheckedUpdateInput): Promise<Task> {
    try {
      return await this.prisma.task.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A task with these attributes already exists");
      }
      throw error;
    }
  }

  /**
   * Guarded transition — only writes if the row's status still equals
   * `from` at write time. Prevents the classic lost-update race: two
   * concurrent requests both read NOT_STARTED, both pass isValidTransition
   * in the use-case, and without this guard the second unconditional
   * `update()` would silently overwrite the first (last-write-wins).
   *
   * `status: from` (not `status: { not: DONE }`) is deliberate — a looser
   * guard would let e.g. BLOCKED->DONE through outside the FSM matrix.
   * Returns the affected row count so the use-case can distinguish
   * "no such row" from "row exists but status moved under us."
   */
  async transitionIfStatusIn(
    id: string,
    from: TaskStatus,
    data: Prisma.TaskUncheckedUpdateInput,
  ): Promise<number> {
    const result = await this.prisma.task.updateMany({
      where: { id, status: from, voidedAt: null },
      data,
    });
    return result.count;
  }

  private buildWhere(filters: TaskListFilters): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {
      shopId: filters.shopId,
      voidedAt: null,
    };

    if (filters.assigneeId) where.assigneeId = filters.assigneeId;

    if (filters.status && filters.isOverdue) {
      where.AND = [{ status: filters.status }, { status: { notIn: ["DONE"] } }];
      where.dueDate = { lt: new Date() };
    } else if (filters.status) {
      where.status = filters.status;
    } else if (filters.isOverdue) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ["DONE"] };
    }

    if (filters.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }

    return where;
  }
}
