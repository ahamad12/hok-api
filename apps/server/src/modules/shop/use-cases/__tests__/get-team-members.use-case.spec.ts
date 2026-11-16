import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { GetTeamMembersUseCase } from "../get-team-members.use-case";

describe("GetTeamMembersUseCase", () => {
  let userRepository: { findByTenant: ReturnType<typeof vi.fn> };
  let useCase: GetTeamMembersUseCase;

  beforeEach(() => {
    userRepository = { findByTenant: vi.fn().mockResolvedValue([]) };
    useCase = new GetTeamMembersUseCase(userRepository as any);
  });

  it("returns no members (and does not query) without a tenant", async () => {
    expect(await useCase.execute({ tenantId: null })).toEqual({ members: [] });
    expect(userRepository.findByTenant).not.toHaveBeenCalled();
  });

  it("queries the requester's tenant", async () => {
    await useCase.execute({ tenantId: "owner-1" });
    expect(userRepository.findByTenant).toHaveBeenCalledWith("owner-1");
  });

  it("orders owner, then managers, then staff, by name within a role", async () => {
    userRepository.findByTenant.mockResolvedValue([
      buildUser({ id: "s2", displayName: "Zed", role: UserRole.STAFF }),
      buildUser({ id: "m1", displayName: "Mia", role: UserRole.MANAGER, shopId: null }),
      buildUser({ id: "s1", displayName: "Amy", role: UserRole.STAFF }),
      buildUser({
        id: "owner-1",
        displayName: "Olu",
        role: UserRole.OWNER,
        shopId: null,
        ownerId: null,
      }),
    ]);
    const { members } = await useCase.execute({ tenantId: "owner-1" });
    expect(members.map((m) => m.id)).toEqual(["owner-1", "m1", "s1", "s2"]);
  });

  it("exposes shopId only for STAFF and never leaks credentials", async () => {
    userRepository.findByTenant.mockResolvedValue([
      buildUser({ id: "m1", role: UserRole.MANAGER, shopId: "stale-shop" }),
      buildUser({ id: "s1", role: UserRole.STAFF, shopId: "shop-1", isSupervisor: true }),
    ]);
    const { members } = await useCase.execute({ tenantId: "owner-1" });
    expect(members.find((m) => m.id === "m1")?.shopId).toBeNull();
    expect(members.find((m) => m.id === "s1")).toMatchObject({
      shopId: "shop-1",
      isSupervisor: true,
    });
    for (const m of members) {
      expect(m).not.toHaveProperty("passwordHash");
      expect(m).not.toHaveProperty("tokenVersion");
    }
  });
});
