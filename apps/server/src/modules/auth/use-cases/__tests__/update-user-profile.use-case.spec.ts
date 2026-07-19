import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { UpdateUserProfileUseCase } from "../update-user-profile.use-case";

describe("UpdateUserProfileUseCase", () => {
  let userRepository: {
    findById: ReturnType<typeof vi.fn>;
    existsByUsername: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let useCase: UpdateUserProfileUseCase;

  beforeEach(() => {
    userRepository = { findById: vi.fn(), existsByUsername: vi.fn(), update: vi.fn() };
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

  it("throws ConflictError when the requested username is already taken by someone else", async () => {
    userRepository.existsByUsername.mockResolvedValue(true);
    await expect(useCase.execute({ userId: "user-1", username: "taken" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("does not check username availability when the username is unchanged", async () => {
    const user = buildUser({ username: "sameuser" });
    userRepository.findById.mockResolvedValue(user);
    await useCase.execute({ userId: "user-1", username: "sameuser" });
    expect(userRepository.existsByUsername).not.toHaveBeenCalled();
  });

  it("does not check username availability when username is not part of the update at all", async () => {
    await useCase.execute({ userId: "user-1", displayName: "Only Name Changes" });
    expect(userRepository.existsByUsername).not.toHaveBeenCalled();
  });

  it("allows explicitly clearing the username to null without a conflict check", async () => {
    await useCase.execute({ userId: "user-1", username: null });
    expect(userRepository.existsByUsername).not.toHaveBeenCalled();
    expect(userRepository.update).toHaveBeenCalledWith("user-1", { username: null });
  });

  it("updates only the fields explicitly provided (partial update)", async () => {
    userRepository.existsByUsername.mockResolvedValue(false);
    await useCase.execute({ userId: "user-1", displayName: "New Name" });
    expect(userRepository.update).toHaveBeenCalledWith("user-1", { displayName: "New Name" });
  });

  it("returns the mapped, updated profile", async () => {
    const result = await useCase.execute({ userId: "user-1", displayName: "Updated" });
    expect(result.displayName).toBe("Updated");
    expect(result).not.toHaveProperty("passwordHash");
  });
});
