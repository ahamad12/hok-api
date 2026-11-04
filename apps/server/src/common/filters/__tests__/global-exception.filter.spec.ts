import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@tapt-api/db/prisma";
import { RequestValidationError } from "@ts-rest/nest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildUniqueViolationError } from "../../../test/fixtures/prisma-error.fixture";
import { AuthenticationError, ERROR_REASONS, NotFoundError } from "../../errors";
import { GlobalExceptionFilter, zodIssuesToViolations } from "../global-exception.filter";

function zodErrorFor(schema: z.ZodTypeAny, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) throw new Error("expected a parse failure");
  return result.error;
}

describe("GlobalExceptionFilter", () => {
  let filter: GlobalExceptionFilter;
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let sentry: { captureException: ReturnType<typeof vi.fn> };
  let res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };

  const host = () =>
    ({
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ url: "/api/v1/x", method: "POST", requestId: "req-1" }),
      }),
    }) as any;

  const send = (exception: unknown) => {
    filter.catch(exception, host());
    return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
  };

  beforeEach(() => {
    logger = { error: vi.fn(), warn: vi.fn() };
    sentry = { captureException: vi.fn() };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    filter = new GlobalExceptionFilter(logger as any, sentry as any);
  });

  it("maps ts-rest body validation to 400 VALIDATION_ERROR with prefixed violations", () => {
    const bodyError = zodErrorFor(z.object({ email: z.string().email() }), { email: "nope" });
    const { status, body } = send(new RequestValidationError(null, null, null, bodyError as any));

    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.violations).toEqual([
      expect.objectContaining({ field: "body.email", message: expect.any(String) }),
    ]);
    // Single violation → its own message is the top-level message.
    expect(body.error.message).toBe(body.error.details.violations[0].message);
  });

  it("collects violations from query and params too", () => {
    const query = zodErrorFor(z.object({ limit: z.number() }), { limit: "x" });
    const params = zodErrorFor(z.object({ id: z.string().uuid() }), { id: "1" });
    const { body } = send(new RequestValidationError(params as any, null, query as any, null));

    const fields = body.error.details.violations.map((v: { field: string }) => v.field);
    expect(fields).toEqual(["params.id", "query.limit"]);
  });

  it("includes reason and requestId for domain errors", () => {
    const { status, body } = send(
      new AuthenticationError("Access token expired", ERROR_REASONS.AUTH_TOKEN_EXPIRED),
    );
    expect(status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      requestId: "req-1",
      path: "/api/v1/x",
      error: { code: "AUTHENTICATION_ERROR", reason: "AUTH_TOKEN_EXPIRED" },
    });
  });

  it("omits reason when the domain error has none", () => {
    const { body } = send(new NotFoundError("Shop", "s1"));
    expect(body.error).not.toHaveProperty("reason");
  });

  it("does not leak the constraint target of an unexpected P2002", () => {
    const { status, body } = send(buildUniqueViolationError(["email"]));
    expect(status).toBe(409);
    expect(body.error).toEqual({ code: "ALREADY_EXISTS", message: "Resource already exists" });
    expect(logger.warn).toHaveBeenCalledWith(
      "Handled exception",
      expect.objectContaining({ prismaMeta: { target: ["email"] } }),
    );
  });

  it("treats a Prisma validation error as a 500 and hides its message", () => {
    const err = new Prisma.PrismaClientValidationError(
      "Invalid `prisma.user.findMany()` invocation",
      {
        clientVersion: "test",
      },
    );
    const { status, body } = send(err);
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("prisma.user");
    expect(sentry.captureException).toHaveBeenCalled();
  });

  it("maps a plain Nest HttpException by status", () => {
    const { status, body } = send(new NotFoundException("Cannot GET /nope"));
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("hides unknown errors behind a generic 500", () => {
    const { status, body } = send(new Error("secret internals"));
    expect(status).toBe(500);
    expect(body.error.message).toBe("An unexpected error occurred");
  });
});

describe("zodIssuesToViolations", () => {
  it("joins nested paths and falls back for root issues", () => {
    expect(
      zodIssuesToViolations(
        [
          { path: ["lines", 0, "qty"], code: "too_small", message: "Too small" },
          { path: [], message: "Bad" },
        ],
        "body",
      ),
    ).toEqual([
      { field: "body.lines.0.qty", code: "too_small", message: "Too small" },
      { field: "body", code: "invalid", message: "Bad" },
    ]);
  });
});
