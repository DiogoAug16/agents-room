import { describe, expect, it } from "vitest";
import { isValidStationCell } from "./station-layout";

describe("station layout", () => {
  const agents = [{ id: "ana", position: { x: 8, y: 6 } }, { id: "bruno", position: { x: 14, y: 8 } }];
  const furniture = new Set(["10,7"]);

  it("accepts a free cell and rejects furniture or another station", () => {
    expect(isValidStationCell({ x: 9, y: 7 }, "ana", agents, furniture)).toBe(true);
    expect(isValidStationCell({ x: 10, y: 7 }, "ana", agents, furniture)).toBe(false);
    expect(isValidStationCell({ x: 14, y: 8 }, "ana", agents, furniture)).toBe(false);
  });
});
