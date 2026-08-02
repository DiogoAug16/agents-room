import { describe, expect, it } from "vitest";
import { panelForShortcut, toggledPanel } from "./workspace-ui-state";

describe("workspace navigation", () => {
  it("keeps one drawer open and closes its active button", () => {
    expect(toggledPanel(null, "agents")).toBe("agents");
    expect(toggledPanel("agents", "tasks")).toBe("tasks");
    expect(toggledPanel("tasks", "tasks")).toBeNull();
  });

  it("maps navigation shortcuts without introducing boolean panel state", () => {
    expect(panelForShortcut("A")).toBe("agents");
    expect(panelForShortcut("t")).toBe("tasks");
    expect(panelForShortcut("x")).toBeUndefined();
  });
});
