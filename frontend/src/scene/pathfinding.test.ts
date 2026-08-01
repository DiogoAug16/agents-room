import { describe, expect, it } from "vitest";
import { cellKey, findNavigationPath, findPath, releaseReservation, reserveRoute, reservedByOthers } from "./pathfinding";
import { NavigationGrid } from "./maps/navigation-grid";

describe("A* pathfinding", () => {
  it("routes around a blocked cell without diagonal moves", () => {
    const path = findPath({ x: 2, y: 2 }, { x: 4, y: 2 }, new Set([cellKey({ x: 3, y: 2 })]));
    expect(path).toEqual([{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }]);
  });

  it("rejects a blocked destination", () => expect(findPath({ x: 1, y: 1 }, { x: 2, y: 1 }, new Set(["2,1"]))).toBeNull());

  it("keeps another agent out of reserved route cells until they are released", () => {
    const reservations = new Map<string, string>();
    expect(reserveRoute(reservations, "ana", [{ x: 1, y: 1 }, { x: 2, y: 1 }])).toBe(true);
    expect(findPath({ x: 3, y: 1 }, { x: 2, y: 1 }, reservedByOthers(reservations, "bruno"))).toBeNull();
    releaseReservation(reservations, "ana", { x: 2, y: 1 });
    expect(findPath({ x: 3, y: 1 }, { x: 2, y: 1 }, reservedByOthers(reservations, "bruno"))).toEqual([{ x: 3, y: 1 }, { x: 2, y: 1 }]);
  });

  it("replans around a route reserved by another agent", () => {
    const reservations = new Map<string, string>();
    reserveRoute(reservations, "ana", [{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(findPath({ x: 1, y: 1 }, { x: 3, y: 1 }, reservedByOthers(reservations, "bruno"))).toEqual([
      { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 },
    ]);
  });

  it("uses only declared navigation cells and reaches a chair approach", () => {
    const navigation = new NavigationGrid();
    const path = findNavigationPath({ x: 8, y: 9 }, { x: 8, y: 7 }, navigation, "ana", new Set());
    expect(path?.at(-1)).toEqual({ x: 8, y: 7 });
    expect(path?.every((point) => navigation.cellAt(point)?.walkable)).toBe(true);
    expect(findNavigationPath({ x: 8, y: 9 }, { x: 10, y: 7 }, navigation, "ana", new Set())).toBeNull();
  });
});
