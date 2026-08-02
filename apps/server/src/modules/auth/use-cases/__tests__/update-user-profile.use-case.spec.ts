import { Prisma } from "@tapt-api/db/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { UpdateUserProfileUseCase } from "../update-user-profile.use-case";

function buildP2002Error(target: string[] = ["username"]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("UpdateUserProfileUseCase", () => {
  let userRepository: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let useCase: UpdateUserProfileUseCase;

  beforeEach(() => {
    userRepository = { findById: vi.fn(), update: vi.fn() };
    useCase = new UpdateUserProfileUseCase(userRepository as any);
    userRepository.findById.mockResolvedValue(buildUser());
    userRepository.update.mockResolvedValue(buildUser({ displayName: "Updated" }));
  });

  it("throws NotFoundError when the user does not exist", async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ userId: "missing", displayName: "X" })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("does not pre-check username availability before updating — goes straight to update", async () => {
    await useCase.execute({ userId: "user-1", username: "newusername" });
    expect(userRepository.update).toHaveBeenCalledTimes(1);
  });

  it("translates a P2002 on username into a ConflictError", async () => {
    userRepository.update.mockRejectedValue(buildP2002Error());
    await expect(useCase.execute({ userId: "user-1", username: "taken" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("rethrows non-P2002 errors from update", async () => {
    const error = new Error("database down");
    userRepository.update.mockRejectedValue(error);
    await expect(useCase.execute({ userId: "user-1", username: "taken" })).rejects.toThrow(error);
  });

  it("allows explicitly clearing the username to null without a conflict", async () => {
    await useCase.execute({ userId: "user-1", username: null });
    expect(userRepository.update).toHaveBeenCalledWith("user-1", { username: null });
  });

  it("updates only the fields explicitly provided (partial update)", async () => {
    await useCase.execute({ userId: "user-1", displayName: "New Name" });
    expect(userRepository.update).toHaveBeenCalledWith("user-1", { displayName: "New Name" });
  });

  it("returns the mapped, updated profile", async () => {
    const result = await useCase.execute({ userId: "user-1", displayName: "Updated" });
    expect(result.displayName).toBe("Updated");
    expect(result).not.toHaveProperty("passwordHash");
  });
});
