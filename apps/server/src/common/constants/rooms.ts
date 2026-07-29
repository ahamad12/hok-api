export const ADMIN_ROOM = "admin";

const ROOM_PREFIX = {
  SHOP: "shop:",
  USER: "user:",
} as const;

export function shopRoom(shopId: string): string {
  return `${ROOM_PREFIX.SHOP}${shopId}`;
}

export function userRoom(userId: string): string {
  return `${ROOM_PREFIX.USER}${userId}`;
}
