export const UserRole = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
