// apps/server/src/modules/ticket/ticket.controller.ts
import { Controller } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ticketContract } from "@tapt-api/api/contracts/ticket.contract";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { UseCaseArg } from "../../common/types/use-case-arg.type";
import {
  toMessageResult,
  toMessageResults,
  toTicketResult,
  toTicketResults,
} from "./mappers/ticket.mapper";
import { AcknowledgeTicketUseCase } from "./use-cases/acknowledge-ticket.use-case";
import { AssignTicketUseCase } from "./use-cases/assign-ticket.use-case";
import { CreateMessageUseCase } from "./use-cases/create-message.use-case";
import { CreateTicketUseCase } from "./use-cases/create-ticket.use-case";
import { GetAcknowledgementsUseCase } from "./use-cases/get-acknowledgements.use-case";
import { GetMessagesUseCase } from "./use-cases/get-messages.use-case";
import { GetTicketByIdUseCase } from "./use-cases/get-ticket-by-id.use-case";
import { GetTicketsUseCase } from "./use-cases/get-tickets.use-case";
import { TransitionTicketUseCase } from "./use-cases/transition-ticket.use-case";

@Controller()
export class TicketController {
  constructor(
    private readonly createTicketUseCase: CreateTicketUseCase,
    private readonly getTicketsUseCase: GetTicketsUseCase,
    private readonly getTicketByIdUseCase: GetTicketByIdUseCase,
    private readonly getMessagesUseCase: GetMessagesUseCase,
    private readonly transitionTicketUseCase: TransitionTicketUseCase,
    private readonly assignTicketUseCase: AssignTicketUseCase,
    private readonly createMessageUseCase: CreateMessageUseCase,
    private readonly acknowledgeTicketUseCase: AcknowledgeTicketUseCase,
    private readonly getAcknowledgementsUseCase: GetAcknowledgementsUseCase,
  ) {}

  @TsRestHandler(ticketContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: UseCaseArg<CreateTicketUseCase, 1> }) => {
      const { ticket, message } = await this.createTicketUseCase.execute(user, body);
      return {
        status: 201 as const,
        body: { ticket: toTicketResult(ticket), message: toMessageResult(message) },
      };
    };
  }

  @TsRestHandler(ticketContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: UseCaseArg<GetTicketsUseCase, 1> }) => {
      const { tickets, total } = await this.getTicketsUseCase.execute(user, query);
      return { status: 200 as const, body: { tickets: toTicketResults(tickets), total } };
    };
  }

  @TsRestHandler(ticketContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      query,
    }: {
      params: { id: string };
      query: { recentMessages: number };
    }) => {
      const { ticket, messages } = await this.getTicketByIdUseCase.execute(
        user,
        params.id,
        query.recentMessages,
      );
      return {
        status: 200 as const,
        body: { ticket: toTicketResult(ticket), messages: toMessageResults(messages) },
      };
    };
  }

  @TsRestHandler(ticketContract.getMessages)
  getMessages(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      query,
    }: {
      params: { id: string };
      query: UseCaseArg<GetMessagesUseCase, 2>;
    }) => {
      const { messages, nextCursor } = await this.getMessagesUseCase.execute(
        user,
        params.id,
        query,
      );
      return { status: 200 as const, body: { messages: toMessageResults(messages), nextCursor } };
    };
  }

  @Throttle({
    "message-burst": { limit: 3, ttl: 1000 },
    "message-sustained": { limit: 30, ttl: 60000 },
  })
  @TsRestHandler(ticketContract.createMessage)
  createMessage(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: UseCaseArg<CreateMessageUseCase, 2>;
    }) => {
      const message = await this.createMessageUseCase.execute(user, params.id, body);
      return { status: 201 as const, body: toMessageResult(message) };
    };
  }

  @TsRestHandler(ticketContract.transition)
  transition(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: { to: UseCaseArg<TransitionTicketUseCase, 2> };
    }) => {
      const ticket = await this.transitionTicketUseCase.execute(user, params.id, body.to);
      return { status: 200 as const, body: toTicketResult(ticket) };
    };
  }

  @TsRestHandler(ticketContract.assign)
  assign(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: { assigneeId: UseCaseArg<AssignTicketUseCase, 2> };
    }) => {
      const ticket = await this.assignTicketUseCase.execute(user, params.id, body.assigneeId);
      return { status: 200 as const, body: toTicketResult(ticket) };
    };
  }

  @TsRestHandler(ticketContract.acknowledge)
  acknowledge(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.acknowledgeTicketUseCase.execute(user, params.id);
      return { status: 200 as const, body: result };
    };
  }

  @TsRestHandler(ticketContract.getAcknowledgements)
  getAcknowledgements(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getAcknowledgementsUseCase.execute(user, params.id);
      return { status: 200 as const, body: result };
    };
  }
}
