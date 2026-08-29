import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { AppGateway } from "../../../infra/gateway/app.gateway";

@Injectable()
export class DailySummaryEventsListener {
  constructor(private readonly gateway: AppGateway) {}

  @OnEvent(SOCKET_EVENTS.DAILY_SUMMARY_FINALIZED)
  onFinalized(payload: {
    summaryId: string;
    shopId: string;
    date: Date;
    closingBalance: number;
    variance: number;
    finalizedById: string;
  }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.DAILY_SUMMARY_FINALIZED, payload);
  }

  @OnEvent(SOCKET_EVENTS.DAILY_SUMMARY_VOIDED)
  onVoided(payload: { summaryId: string; shopId: string; date: Date; voidedById: string }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.DAILY_SUMMARY_VOIDED, payload);
  }
}
