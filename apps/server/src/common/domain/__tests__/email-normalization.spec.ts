import { authContract } from "@tapt-api/api/contracts/auth.contract";
import { emailSchema, normalizeEmail } from "@tapt-api/api/validators/email";
import { describe, expect, it } from "vitest";

describe("email normalisation (shared contract)", () => {
  it("normalizeEmail trims and lower-cases", () => {
    expect(normalizeEmail("  Owner@Shop.TEST ")).toBe("owner@shop.test");
  });

  it("emailSchema outputs the normalised email and still rejects junk", () => {
    expect(emailSchema.parse(" Owner@Shop.test ")).toBe("owner@shop.test");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("login body is normalised by the contract", () => {
    const parsed = (authContract.login.body as { parse: (v: unknown) => { email: string } }).parse({
      email: "Owner@Shop.test",
      password: "x",
    });
    expect(parsed.email).toBe("owner@shop.test");
  });
});
