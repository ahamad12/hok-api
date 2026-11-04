import { Controller } from "@nestjs/common";
import { formContract } from "@tapt-api/api/contracts/form.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { UseCaseArg } from "../../common/types/use-case-arg.type";
import {
  toFormResult,
  toFormResults,
  toFormSubmissionResult,
  toFormSubmissionResults,
} from "./mappers/form.mapper";
import { CreateFormUseCase } from "./use-cases/create-form.use-case";
import { GetFormByIdUseCase } from "./use-cases/get-form-by-id.use-case";
import { GetFormsUseCase } from "./use-cases/get-forms.use-case";
import { GetSubmissionsUseCase } from "./use-cases/get-submissions.use-case";
import { SubmitFormUseCase } from "./use-cases/submit-form.use-case";
import { UpdateFormUseCase } from "./use-cases/update-form.use-case";

@Controller()
export class FormController {
  constructor(
    private readonly createForm: CreateFormUseCase,
    private readonly getForms: GetFormsUseCase,
    private readonly getFormById: GetFormByIdUseCase,
    private readonly updateForm: UpdateFormUseCase,
    private readonly submitForm: SubmitFormUseCase,
    private readonly getSubmissions: GetSubmissionsUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(formContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: UseCaseArg<CreateFormUseCase, 1> }) => {
      const form = await this.createForm.execute(user, body);
      return { status: 201 as const, body: toFormResult(form) };
    };
  }

  // No @Roles — shop-scoping is enforced inside GetFormsUseCase, not the
  // guard, because STAFF must hit this endpoint too (they fill forms out).
  @TsRestHandler(formContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: UseCaseArg<GetFormsUseCase, 1> }) => {
      const forms = await this.getForms.execute(user, query);
      return { status: 200 as const, body: { forms: toFormResults(forms) } };
    };
  }

  @TsRestHandler(formContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const form = await this.getFormById.execute(user, params.id);
      return { status: 200 as const, body: toFormResult(form) };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(formContract.update)
  update(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: UseCaseArg<UpdateFormUseCase, 2>;
    }) => {
      const form = await this.updateForm.execute(user, params.id, body);
      return { status: 200 as const, body: toFormResult(form) };
    };
  }

  // No @Roles — submission is STAFF's entire reason to hit this module;
  // OWNER/MANAGER can also submit (e.g. testing a form pre-publish).
  @TsRestHandler(formContract.submit)
  submit(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: { answers: UseCaseArg<SubmitFormUseCase, 2> };
    }) => {
      const submission = await this.submitForm.execute(user, params.id, body.answers);
      return { status: 201 as const, body: toFormSubmissionResult(submission) };
    };
  }

  @TsRestHandler(formContract.getSubmissions)
  getSubmissionsHandler(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      query,
    }: {
      params: { id: string };
      query: UseCaseArg<GetSubmissionsUseCase, 2>;
    }) => {
      const { submissions, total } = await this.getSubmissions.execute(user, params.id, query);
      return {
        status: 200 as const,
        body: { submissions: toFormSubmissionResults(submissions), total },
      };
    };
  }
}
