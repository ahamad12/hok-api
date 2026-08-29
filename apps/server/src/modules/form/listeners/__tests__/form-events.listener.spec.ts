import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { describe, expect, it, vi } from "vitest";
import { FormEventsListener } from "../form-events.listener";

describe("FormEventsListener", () => {
  it("relays the payload to the shop's socket room unchanged", () => {
    const gateway = { emitToShop: vi.fn() };
    const listener = new FormEventsListener(gateway as any);

    const payload = { formId: "f1", shopId: "s1", submissionId: "sub1", staffId: "u1" };
    listener.onSubmitted(payload);

    expect(gateway.emitToShop).toHaveBeenCalledWith("s1", SOCKET_EVENTS.FORM_SUBMITTED, payload);
  });
});
