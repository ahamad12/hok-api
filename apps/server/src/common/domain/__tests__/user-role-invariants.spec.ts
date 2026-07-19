import { describe, expect, it } from "vitest";
import { UserRole } from "../../../test/prisma-client-mock";
import { BusinessRuleError } from "../../errors";
import { assertValidUserRoleAssignment, checkUserRoleInvariants } from "../user-role-invariants";

describe("checkUserRoleInvariants", () => {
  it("returns no violations for a valid supervisor STAFF assigned to a shop", () => {
    const violations = checkUserRoleInvariants({
      role: UserRole.STAFF,
      shopId: "shop-1",
      isSupervisor: true,
    });
    expect(violations).toEqual([]);
  });

  it("returns no violations for a plain (non-supervisor) STAFF assigned to a shop", () => {
    const violations = checkUserRoleInvariants({
      role: UserRole.STAFF,
      shopId: "shop-1",
      isSupervisor: false,
    });
    expect(violations).toEqual([]);
  });

  it("flags OWNER with a shopId as a violation", () => {
    const violations = checkUserRoleInvariants({
      role: UserRole.OWNER,
      shopId: "shop-1",
      isSupervisor: false,
    });
    expect(violations).toContainEqual({
      field: "shopId",
      message: "Owners cannot be assigned to shops",
    });
  });

  it("flags MANAGER with a shopId as a violation", () => {
    const violations = checkUserRoleInvariants({
      role: UserRole.MANAGER,
      shopId: "shop-1",
      isSupervisor: false,
    });
    expect(violations.some((v) => v.field === "shopId")).toBe(true);
  });

  it("flags isSupervisor=true on a non-STAFF role as a violation", () => {
    const violations = checkUserRoleInvariants({
      role: UserRole.MANAGER,
      shopId: null,
      isSupervisor: true,
    });
    expect(violations.some((v) => v.field === "isSupervisor")).toBe(true);
  });

  it("flags a supervisor STAFF with no shopId as a violation", () => {
    const violations = checkUserRoleInvariants({
      role: UserRole.STAFF,
      shopId: null,
      isSupervisor: true,
    });
    expect(violations.some((v) => v.field === "shopId")).toBe(true);
  });

  it("returns no violations for OWNER with no shopId", () => {
    const violations = checkUserRoleInvariants({
      role: UserRole.OWNER,
      shopId: null,
      isSupervisor: false,
    });
    expect(violations).toEqual([]);
  });

  it("accumulates multiple violations at once rather than stopping at the first", () => {
    const violations = checkUserRoleInvariants({
      role: UserRole.MANAGER,
      shopId: "shop-1",
      isSupervisor: true,
    });
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe("assertValidUserRoleAssignment", () => {
  it("does not throw for a valid assignment", () => {
    expect(() =>
      assertValidUserRoleAssignment({ role: UserRole.STAFF, shopId: "shop-1", isSupervisor: true }),
    ).not.toThrow();
  });

  it("throws BusinessRuleError (a proper DomainError subclass, not a raw Error) on violation", () => {
    expect(() =>
      assertValidUserRoleAssignment({
        role: UserRole.OWNER,
        shopId: "shop-1",
        isSupervisor: false,
      }),
    ).toThrow(BusinessRuleError);
  });

  it("attaches the violation details onto the thrown error for the error middleware to surface", () => {
    try {
      assertValidUserRoleAssignment({
        role: UserRole.OWNER,
        shopId: "shop-1",
        isSupervisor: false,
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as BusinessRuleError).details).toEqual({
        violations: [{ field: "shopId", message: "Owners cannot be assigned to shops" }],
      });
    }
  });
});
