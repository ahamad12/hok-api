// apps/server/src/modules/ticket/ticket.module.ts
import { forwardRef, Module } from "@nestjs/common";
import { GatewayModule } from "../../infra/gateway/gateway.module";
import { AuthModule } from "../auth/auth.module";
import { ShopModule } from "../shop/shop.module";
import { TicketEventsListener } from "./listeners/ticket-events.listener";
import { TicketRepository } from "./repositories/ticket.repository";
import { TicketAcknowledgementRepository } from "./repositories/ticket-acknowledgement.repository";
import { TicketMessageRepository } from "./repositories/ticket-message.repository";
import { TicketController } from "./ticket.controller";
import { AcknowledgeTicketUseCase } from "./use-cases/acknowledge-ticket.use-case";
import { AssignTicketUseCase } from "./use-cases/assign-ticket.use-case";
import { CreateMessageUseCase } from "./use-cases/create-message.use-case";
import { CreateTicketUseCase } from "./use-cases/create-ticket.use-case";
import { GetAcknowledgementsUseCase } from "./use-cases/get-acknowledgements.use-case";
import { GetMessagesUseCase } from "./use-cases/get-messages.use-case";
import { GetTicketByIdUseCase } from "./use-cases/get-ticket-by-id.use-case";
import { GetTicketsUseCase } from "./use-cases/get-tickets.use-case";
import { TransitionTicketUseCase } from "./use-cases/transition-ticket.use-case";

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => ShopModule), GatewayModule],
  controllers: [TicketController],
  providers: [
    TicketRepository,
    TicketMessageRepository,
    TicketAcknowledgementRepository,
    CreateTicketUseCase,
    GetTicketsUseCase,
    GetTicketByIdUseCase,
    GetMessagesUseCase,
    TransitionTicketUseCase,
    AssignTicketUseCase,
    CreateMessageUseCase,
    AcknowledgeTicketUseCase,
    GetAcknowledgementsUseCase,
    TicketEventsListener,
  ],
})
export class TicketModule {}
