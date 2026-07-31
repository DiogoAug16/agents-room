import { describe, expect, it } from "vitest";
import { gridToScreen, screenToGrid } from "./grid";

describe("isometric coordinates", () => {
  it("round trips a grid cell", () => {
    const cell = { x: 7, y: 11 };
    expect(screenToGrid(gridToScreen(cell).x, gridToScreen(cell).y)).toEqual(cell);
  });
});
