import { Controller } from "@nestjs/common";
import { teamContract } from "@tapt-api/api/contracts/team.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import { GetTeamMembersUseCase } from "./use-cases/get-team-members.use-case";

@Controller()
export class TeamController {
  constructor(private readonly getTeamMembersUseCase: GetTeamMembersUseCase) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(teamContract.getMembers)
  getMembers(@CurrentUser() user: RequestUser) {
    return async () => {
      const result = await this.getTeamMembersUseCase.execute({
        tenantId: user.tenantId ?? null,
      });
      return { status: 200 as const, body: result };
    };
  }
}
