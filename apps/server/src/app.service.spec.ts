import { describe, it, expect } from "vitest";
import { AppService } from "./app.service";

describe("AppService", () => {
  it('should return "OK"', () => {
    const service = new AppService();
    expect(service.getHello()).toBe("OK");
  });
});
