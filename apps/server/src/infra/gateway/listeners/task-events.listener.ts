import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { AppGateway } from "../app.gateway";

@Injectable()
export class TaskEventsListener {
  constructor(private readonly gateway: AppGateway) {}

  @OnEvent("task.assigned")
  handleTaskAssigned(payload: { taskId: string; title: string; assigneeId: string }) {
    this.gateway.emitToUser(payload.assigneeId, SOCKET_EVENTS.TASK_ASSIGNED, payload);
  }

  @OnEvent("task.status_changed")
  handleTaskStatusChanged(payload: { taskId: string; status: string; shopId: string }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.TASK_UPDATED, {
      taskId: payload.taskId,
      status: payload.status,
    });
  }
}
