import { describe, expect, it, vi } from "vitest";
import { IdleBehaviorController } from "./idle-behavior-controller";

describe("idle behavior controller", () => {
  it("cancels a scheduled behavior before it can run", () => {
    vi.useFakeTimers(); const execute = vi.fn(); const controller = new IdleBehaviorController({ canRun: () => true, execute }, 15, 16, () => 0);
    controller.scheduleNextBehavior("ana"); controller.cancelBehavior("ana"); vi.advanceTimersByTime(20);
    expect(execute).not.toHaveBeenCalled(); vi.useRealTimers();
  });
});
