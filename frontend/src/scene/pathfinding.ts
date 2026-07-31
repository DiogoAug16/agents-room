import type { GridPoint } from "../types";
import { GRID_HEIGHT, GRID_WIDTH, isInsideGrid } from "./grid";

const key = ({ x, y }: GridPoint) => `${x},${y}`;
const distance = (a: GridPoint, b: GridPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function findPath(start: GridPoint, goal: GridPoint, blocked: ReadonlySet<string>): GridPoint[] | null {
  if (!isInsideGrid(start) || !isInsideGrid(goal) || blocked.has(key(goal))) return null;
  const open = [start];
  const previous = new Map<string, GridPoint>();
  const cost = new Map([[key(start), 0]]);
  while (open.length) {
    open.sort((a, b) => (cost.get(key(a))! + distance(a, goal)) - (cost.get(key(b))! + distance(b, goal)));
    const current = open.shift()!;
    if (key(current) === key(goal)) {
      const path = [current];
      while (previous.has(key(path[0]))) path.unshift(previous.get(key(path[0]))!);
      return path;
    }
    for (const next of [{ x: current.x, y: current.y - 1 }, { x: current.x + 1, y: current.y }, { x: current.x, y: current.y + 1 }, { x: current.x - 1, y: current.y }]) {
      if (!isInsideGrid(next) || blocked.has(key(next))) continue;
      const nextCost = cost.get(key(current))! + 1;
      if (nextCost < (cost.get(key(next)) ?? Infinity)) { cost.set(key(next), nextCost); previous.set(key(next), current); if (!open.some((node) => key(node) === key(next))) open.push(next); }
    }
  }
  return null;
}

export const cellKey = key;
