import { describe, expect, it } from "vitest";
import { buildNavigationCells, isInsideEmptyRoomFloor, STATIC_SEATS, homeSeatForAgent } from "./office-layout";

describe("office layout", () => {
  it("keeps the empty-room floor walkable and the exterior blocked", () => {
    const cells = buildNavigationCells(new Map([["10,14", "desk-1"]]));
    expect(isInsideEmptyRoomFloor({ x: 11, y: 16 })).toBe(true);
    expect(isInsideEmptyRoomFloor({ x: 0, y: 0 })).toBe(false);
    expect(cells.find((cell) => cell.gridX === 11 && cell.gridY === 16)).toMatchObject({ type: "walkable", walkable: true, movementCost: 1 });
    expect(cells.find((cell) => cell.gridX === 10 && cell.gridY === 14)).toMatchObject({ type: "blocked", walkable: false, objectId: "desk-1" });
    expect(new Set(STATIC_SEATS.map((seat) => seat.id)).size).toBe(STATIC_SEATS.length);
  });

  it("binds every agent to its own workstation seat and approach", () => {
    const seat = homeSeatForAgent({ id: "ana", basePosition: { x: 10, y: 23 } });
    expect(seat.id).toBe("workstation-ana-seat");
    expect(seat.approachPosition).toEqual({ x: 10, y: 25 });
    expect(seat.ownerAgentId).toBe("ana");
    expect(homeSeatForAgent({ id: "ana", basePosition: { x: 10, y: 23 } })).toEqual(seat);
  });
});
