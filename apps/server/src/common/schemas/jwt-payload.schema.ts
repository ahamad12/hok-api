// common/schemas/jwt-payload.schema.ts —
import { UserRole } from "@tapt-api/db";
import { z } from "zod";

export const accessTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  shopId: z.string().uuid().nullable(),
  isSupervisor: z.boolean(),
  tokenVersion: z.number().int().nonnegative(),
  // Session (refresh-token family) id. Optional so access tokens minted
  // before sessions existed stay valid until they expire (≤ 15 min).
  sid: z.string().uuid().optional(),
});

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;
