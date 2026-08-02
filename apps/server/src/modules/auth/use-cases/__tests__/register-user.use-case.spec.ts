import { Prisma } from "@tapt-api/db/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { UserRole } from "../../../../test/prisma-client-mock";
import { RegisterUserUseCase } from "../register-user.use-case";

function buildP2002Error(target: string[] = ["email"]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("RegisterUserUseCase", () => {
  let userRepository: {
    create: ReturnType<typeof vi.fn>;
  };
  let passwordHasher: { hash: ReturnType<typeof vi.fn> };
  let prisma: { shop: { findUnique: ReturnType<typeof vi.fn> } };
  let useCase: RegisterUserUseCase;

  const validInput = {
    email: "new@shop.test",
    password: "ValidPass1!",
    displayName: "New Staff",
    role: UserRole.STAFF,
    shopId: "shop-1",
    isSupervisor: false,
  };

  beforeEach(() => {
    userRepository = { create: vi.fn() };
    passwordHasher = { hash: vi.fn().mockResolvedValue("hashed-pw") };
    prisma = { shop: { findUnique: vi.fn() } };
    useCase = new RegisterUserUseCase(userRepository as any, passwordHasher as any, prisma as any);

    prisma.shop.findUnique.mockResolvedValue({ id: "shop-1" });
    userRepository.create.mockResolvedValue(buildUser(validInput as any));
  });

  it("does not pre-check email/username before creating — goes straight to create", async () => {
    await useCase.execute(validInput);
    expect(userRepository.create).toHaveBeenCalledTimes(1);
  });

  it("translates a P2002 on email into a ConflictError", async () => {
    userRepository.create.mockRejectedValue(buildP2002Error(["email"]));
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError);
  });

  it("translates a P2002 on username into a ConflictError", async () => {
    userRepository.create.mockRejectedValue(buildP2002Error(["username"]));
    await expect(useCase.execute({ ...validInput, username: "taken" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("rethrows non-P2002 errors from create", async () => {
    const error = new Error("database down");
    userRepository.create.mockRejectedValue(error);
    await expect(useCase.execute(validInput)).rejects.toThrow(error);
  });

  it("throws NotFoundError when shopId does not correspond to an existing shop", async () => {
    prisma.shop.findUnique.mockResolvedValue(null);
    await expect(useCase.execute(validInput)).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError for an invalid role/shop/supervisor combination", async () => {
    await expect(
      useCase.execute({ ...validInput, role: UserRole.OWNER, shopId: "shop-1" }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("does not query for shop existence when shopId is not provided", async () => {
    await useCase.execute({
      ...validInput,
      role: UserRole.MANAGER,
      shopId: null,
      isSupervisor: false,
    });
    expect(prisma.shop.findUnique).not.toHaveBeenCalled();
  });

  it("hashes the password before persisting the user", async () => {
    await useCase.execute(validInput);
    expect(passwordHasher.hash).toHaveBeenCalledWith(validInput.password);
    const createArgs = userRepository.create.mock.calls[0]![0]!;
    expect(createArgs.passwordHash).toBe("hashed-pw");
    expect(createArgs).not.toHaveProperty("password");
  });

  it("creates the user and returns a result without the password hash", async () => {
    const result = await useCase.execute(validInput);
    expect(result.user.email).toBe(validInput.email);
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("defaults isSupervisor to false and shopId to null when omitted", async () => {
    await useCase.execute({
      email: "x@shop.test",
      password: "ValidPass1!",
      displayName: "X",
      role: UserRole.MANAGER,
    });
    const createArgs = userRepository.create.mock.calls[0]![0]!;
    expect(createArgs.isSupervisor).toBe(false);
    expect(createArgs.shopId).toBeNull();
  });
});
