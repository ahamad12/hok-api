import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../common/errors";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import * as mapperModule from "../../mappers/user-profile.mapper";
import { GetUserProfileUseCase } from "../get-user-profile.use-case";

describe("GetUserProfileUseCase", () => {
  let userRepository: { findById: ReturnType<typeof vi.fn> };
  let useCase: GetUserProfileUseCase;

  beforeEach(() => {
    userRepository = { findById: vi.fn() };
    useCase = new GetUserProfileUseCase(userRepository as any);
  });

  it("throws NotFoundError when the user does not exist", async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ userId: "missing" })).rejects.toThrow(NotFoundError);
  });

  it("maps the found user through toUserProfile", async () => {
    const user = buildUser();
    userRepository.findById.mockResolvedValue(user);
    const mapSpy = vi.spyOn(mapperModule, "toUserProfile");

    await useCase.execute({ userId: user.id });
    expect(mapSpy).toHaveBeenCalledWith(user);
  });

  it("never leaks passwordHash on the returned profile", async () => {
    const user = buildUser();
    userRepository.findById.mockResolvedValue(user);
    const result = await useCase.execute({ userId: user.id });
    expect(result).not.toHaveProperty("passwordHash");
  });
});
