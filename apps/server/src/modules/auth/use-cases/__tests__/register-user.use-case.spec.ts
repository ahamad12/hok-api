import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { UserRole } from "../../../../test/prisma-client-mock";
import { RegisterUserUseCase } from "../register-user.use-case";

describe("RegisterUserUseCase", () => {
  let userRepository: {
    existsByEmail: ReturnType<typeof vi.fn>;
    existsByUsername: ReturnType<typeof vi.fn>;
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
    userRepository = { existsByEmail: vi.fn(), existsByUsername: vi.fn(), create: vi.fn() };
    passwordHasher = { hash: vi.fn().mockResolvedValue("hashed-pw") };
    prisma = { shop: { findUnique: vi.fn() } };
    useCase = new RegisterUserUseCase(userRepository as any, passwordHasher as any, prisma as any);

    userRepository.existsByEmail.mockResolvedValue(false);
    userRepository.existsByUsername.mockResolvedValue(false);
    prisma.shop.findUnique.mockResolvedValue({ id: "shop-1" });
    userRepository.create.mockResolvedValue(buildUser(validInput as any));
  });

  it("throws ConflictError when the email is already taken", async () => {
    userRepository.existsByEmail.mockResolvedValue(true);
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError);
  });

  it("throws ConflictError when the username is already taken", async () => {
    userRepository.existsByUsername.mockResolvedValue(true);
    await expect(useCase.execute({ ...validInput, username: "taken" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("skips the username check entirely when no username is provided", async () => {
    await useCase.execute(validInput);
    expect(userRepository.existsByUsername).not.toHaveBeenCalled();
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
