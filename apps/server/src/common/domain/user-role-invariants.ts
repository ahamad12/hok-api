// common/domain/user-role-invariants.ts — unchanged, this file was already solid
import { UserRole } from "@tapt-api/db";
import { BusinessRuleError } from "../errors";

export interface UserRoleAssignmentInput {
  role: UserRole;
  shopId: string | null;
  isSupervisor: boolean;
}

export interface UserRoleInvariantViolation {
  field: "role" | "shopId" | "isSupervisor";
  message: string;
}

export function checkUserRoleInvariants(
  input: UserRoleAssignmentInput,
): UserRoleInvariantViolation[] {
  const violations: UserRoleInvariantViolation[] = [];
  if (input.isSupervisor && input.role !== UserRole.STAFF) {
    violations.push({ field: "isSupervisor", message: "Only STAFF can be supervisors" });
  }
  if (input.isSupervisor && !input.shopId) {
    violations.push({ field: "shopId", message: "Supervisors must be assigned to a shop" });
  }
  if (input.role === UserRole.OWNER && input.shopId) {
    violations.push({ field: "shopId", message: "Owners cannot be assigned to shops" });
  }
  if (input.role === UserRole.MANAGER && input.shopId) {
    violations.push({
      field: "shopId",
      message: "Managers have system-wide access and cannot be assigned to specific shops",
    });
  }
  return violations;
}

export function assertValidUserRoleAssignment(input: UserRoleAssignmentInput): void {
  const violations = checkUserRoleInvariants(input);
  if (violations.length > 0) {
    throw new BusinessRuleError("Invalid role/shop/supervisor combination", { violations });
  }
}
