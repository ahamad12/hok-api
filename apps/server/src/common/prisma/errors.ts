// The single definition of Prisma known-request errors. Repositories are
// the only layer that touches Prisma, so they are the only consumers of
// these guards — use-cases must never import from @tapt-api/db/prisma.
// The global exception filter handles Prisma errors at the HTTP boundary
// directly and does not need these helpers.
//
// Always import Prisma via @tapt-api/db/prisma, never @prisma/client
// directly — instanceof checks fail across duplicate module instances
// even with correct tsdown externalization.
import { Prisma } from "@tapt-api/db/prisma";

function isPrismaErrorWithCode<Code extends string>(
  error: unknown,
  code: Code,
): error is Prisma.PrismaClientKnownRequestError & { code: Code } {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return isPrismaErrorWithCode(error, "P2002");
}

export function isNotFound(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return isPrismaErrorWithCode(error, "P2025");
}
