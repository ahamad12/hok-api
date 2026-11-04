import { UserRole } from "../prisma-client-mock";

interface UserFixture {
  id: string;
  username: string | null;
  email: string;
  displayName: string;
  passwordHash: string;
  isActive: boolean;
  isSupervisor: boolean;
  role: UserRole;
  shopId: string | null;
  ownerId: string | null;
  tokenVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function buildUser(overrides?: Partial<UserFixture>): UserFixture {
  return {
    id: "user-1",
    username: null,
    email: "staff@shop.test",
    displayName: "Staff User",
    passwordHash: "$2b$10$hashedpassword",
    isActive: true,
    isSupervisor: false,
    role: UserRole.STAFF,
    shopId: "shop-1",
    // Tenant owner; matches buildShop()'s ownerId. Ignored for OWNER users.
    ownerId: "owner-1",
    tokenVersion: 1,
    lastLoginAt: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}
