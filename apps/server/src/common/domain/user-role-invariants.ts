// common/domain/user-role-invariants.ts — the one source of role/shop/tenant rules.
import { UserRole } from "@tapt-api/db";
import { BusinessRuleError } from "../errors";

export interface UserRoleAssignmentInput {
  role: UserRole;
  shopId: string | null;
  isSupervisor: boolean;
  /** Tenant owner. Checked only when given (writes that set it: sign-up,
   *  invitation acceptance); omit when validating an existing user's role. */
  ownerId?: string | null;
}

export interface UserRoleInvariantViolation {
  field: "role" | "shopId" | "isSupervisor" | "ownerId";
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
      message: "Managers manage the whole business and cannot be assigned to specific shops",
    });
  }
  if (input.ownerId !== undefined) {
    if (input.role === UserRole.OWNER && input.ownerId !== null) {
      violations.push({ field: "ownerId", message: "Owners cannot belong to another business" });
    }
    if (input.role !== UserRole.OWNER && !input.ownerId) {
      violations.push({
        field: "ownerId",
        message: "Managers and staff must belong to a business",
      });
    }
  }
  return violations;
}

export function assertValidUserRoleAssignment(input: UserRoleAssignmentInput): void {
  const violations = checkUserRoleInvariants(input);
  if (violations.length > 0) {
    throw new BusinessRuleError("Invalid role/shop/supervisor combination", { violations });
  }
}
