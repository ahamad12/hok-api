import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { AppGateway } from "../../../infra/gateway/app.gateway";

interface FormSubmittedPayload {
  formId: string;
  shopId: string;
  submissionId: string;
  staffId: string;
}

@Injectable()
export class FormEventsListener {
  constructor(private readonly gateway: AppGateway) {}

  @OnEvent(SOCKET_EVENTS.FORM_SUBMITTED)
  onSubmitted(payload: FormSubmittedPayload) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.FORM_SUBMITTED, payload);
  }
}
