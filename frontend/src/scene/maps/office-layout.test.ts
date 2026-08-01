import { describe, expect, it } from "vitest";
import { buildNavigationCells, CORRIDORS, STATIC_SEATS, homeSeatForAgent } from "./office-layout";

describe("office layout", () => {
  it("declares connected corridor cells and unique seat ids", () => {
    const cells = buildNavigationCells();
    expect(CORRIDORS.flatMap((area) => area.cells)).toContainEqual({ x: 7, y: 13 });
    expect(cells.find((cell) => cell.gridX === 7 && cell.gridY === 13)).toMatchObject({ type: "corridor", walkable: true, movementCost: 1 });
    expect(new Set(STATIC_SEATS.map((seat) => seat.id)).size).toBe(STATIC_SEATS.length);
    expect(cells.find((cell) => cell.objectId === "sofa-bottom-center")).toMatchObject({ type: "seat", walkable: false });
  });

  it("binds every agent to its own workstation seat and approach", () => {
    const seat = homeSeatForAgent({ id: "ana", basePosition: { x: 9, y: 12 } });
    expect(seat.id).toBe("workstation-ana-seat");
    expect(seat.approachPosition).toEqual({ x: 9, y: 13 });
    expect(seat.ownerAgentId).toBe("ana");
    expect(homeSeatForAgent({ id: "ana", basePosition: { x: 9, y: 12 } })).toEqual(seat);
  });
});
