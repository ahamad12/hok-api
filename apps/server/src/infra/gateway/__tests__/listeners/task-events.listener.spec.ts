import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskEventsListener } from "../../listeners/task-events.listener";

describe("TaskEventsListener", () => {
  let gateway: { emitToUser: ReturnType<typeof vi.fn>; emitToShop: ReturnType<typeof vi.fn> };
  let listener: TaskEventsListener;

  beforeEach(() => {
    gateway = { emitToUser: vi.fn(), emitToShop: vi.fn() };
    listener = new TaskEventsListener(gateway as any);
  });

  describe("handleTaskAssigned", () => {
    it("emits TASK_ASSIGNED to the assignee", () => {
      const payload = { taskId: "t-1", title: "Fix register", assigneeId: "user-1" };
      listener.handleTaskAssigned(payload);
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        "user-1",
        SOCKET_EVENTS.TASK_ASSIGNED,
        payload,
      );
    });
  });

  describe("handleTaskStatusChanged", () => {
    it("emits TASK_UPDATED to the shop with mapped payload", () => {
      listener.handleTaskStatusChanged({ taskId: "t-1", status: "DONE", shopId: "shop-1" });
      expect(gateway.emitToShop).toHaveBeenCalledWith("shop-1", SOCKET_EVENTS.TASK_UPDATED, {
        taskId: "t-1",
        status: "DONE",
      });
    });
  });
});
