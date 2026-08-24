import { Prisma } from "@tapt-api/db/prisma";

export function buildUniqueViolationError(
  target: string[] = ["name"],
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

export function buildNotFoundError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Record to delete does not exist", {
    code: "P2025",
    clientVersion: "test",
  });
}
