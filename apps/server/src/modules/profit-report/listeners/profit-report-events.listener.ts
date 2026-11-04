import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { AppGateway } from "../../../infra/gateway/app.gateway";

@Injectable()
export class ProfitReportEventsListener {
  constructor(private readonly gateway: AppGateway) {}

  @OnEvent(SOCKET_EVENTS.PROFIT_REPORT_GENERATED)
  onGenerated(payload: {
    reportId: string;
    shopId: string;
    periodStart: Date;
    periodEnd: Date;
    netProfit: number;
    profitMargin: number;
    generatedById: string;
  }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.PROFIT_REPORT_GENERATED, payload);
  }

  @OnEvent(SOCKET_EVENTS.PROFIT_REPORT_VOIDED)
  onVoided(payload: {
    reportId: string;
    shopId: string;
    periodStart: Date;
    periodEnd: Date;
    voidedById: string;
  }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.PROFIT_REPORT_VOIDED, payload);
  }
}
