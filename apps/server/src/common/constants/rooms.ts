const ROOM_PREFIX = {
  SHOP: "shop:",
  USER: "user:",
  TENANT_ADMINS: "tenant-admins:",
} as const;

export function shopRoom(shopId: string): string {
  return `${ROOM_PREFIX.SHOP}${shopId}`;
}

export function userRoom(userId: string): string {
  return `${ROOM_PREFIX.USER}${userId}`;
}

/** OWNER/MANAGER sockets of one business. There is deliberately no
 *  cross-tenant "admin" room: a broadcast must always name its tenant. */
export function tenantAdminRoom(tenantId: string): string {
  return `${ROOM_PREFIX.TENANT_ADMINS}${tenantId}`;
}
