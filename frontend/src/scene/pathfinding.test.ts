import { describe, expect, it } from "vitest";
import { cellKey, findPath } from "./pathfinding";

describe("A* pathfinding", () => {
  it("routes around a blocked cell without diagonal moves", () => {
    const path = findPath({ x: 2, y: 2 }, { x: 4, y: 2 }, new Set([cellKey({ x: 3, y: 2 })]));
    expect(path).toEqual([{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }]);
  });

  it("rejects a blocked destination", () => expect(findPath({ x: 1, y: 1 }, { x: 2, y: 1 }, new Set(["2,1"]))).toBeNull());
});
