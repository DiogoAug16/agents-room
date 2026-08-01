import type { GridPoint } from "../types";
import { GRID_HEIGHT, GRID_WIDTH, isInsideGrid } from "./grid";
import type { NavigationGrid } from "./maps/navigation-grid";

const key = ({ x, y }: GridPoint) => `${x},${y}`;
const distance = (a: GridPoint, b: GridPoint) => {
  const dx = Math.abs(a.x - b.x); const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
};
const neighbors = (current: GridPoint) => [
  { x: current.x, y: current.y - 1, cost: 1 }, { x: current.x + 1, y: current.y, cost: 1 },
  { x: current.x, y: current.y + 1, cost: 1 }, { x: current.x - 1, y: current.y, cost: 1 },
  { x: current.x + 1, y: current.y - 1, cost: Math.SQRT2 }, { x: current.x + 1, y: current.y + 1, cost: Math.SQRT2 },
  { x: current.x - 1, y: current.y + 1, cost: Math.SQRT2 }, { x: current.x - 1, y: current.y - 1, cost: Math.SQRT2 },
];
const diagonalIsClear = (current: GridPoint, next: GridPoint, canEnter: (point: GridPoint) => boolean) => current.x === next.x || current.y === next.y || (canEnter({ x: next.x, y: current.y }) && canEnter({ x: current.x, y: next.y }));

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
    for (const next of neighbors(current)) {
      const point = { x: next.x, y: next.y };
      const canEnter = (candidate: GridPoint) => isInsideGrid(candidate) && !blocked.has(key(candidate));
      if (!canEnter(point) || !diagonalIsClear(current, point, canEnter)) continue;
      const nextCost = cost.get(key(current))! + next.cost;
      if (nextCost < (cost.get(key(point)) ?? Infinity)) { cost.set(key(point), nextCost); previous.set(key(point), current); if (!open.some((node) => key(node) === key(point))) open.push(point); }
    }
  }
  return null;
}

export function findNavigationPath(start: GridPoint, goal: GridPoint, navigation: NavigationGrid, agentId: string, blocked: ReadonlySet<string>): GridPoint[] | null {
  if (!navigation.canEnter(goal, agentId, blocked)) return null;
  const open = [start]; const previous = new Map<string, GridPoint>(); const cost = new Map([[key(start), 0]]);
  while (open.length) {
    open.sort((a, b) => (cost.get(key(a))! + distance(a, goal)) - (cost.get(key(b))! + distance(b, goal)));
    const current = open.shift()!;
    if (key(current) === key(goal)) { const path = [current]; while (previous.has(key(path[0]))) path.unshift(previous.get(key(path[0]))!); return path; }
    for (const next of neighbors(current)) {
      const point = { x: next.x, y: next.y };
      const canEnter = (candidate: GridPoint) => isInsideGrid(candidate) && navigation.canEnter(candidate, agentId, blocked);
      if (!canEnter(point) || !diagonalIsClear(current, point, canEnter)) continue;
      const nextCost = cost.get(key(current))! + next.cost * navigation.movementCost(point);
      if (nextCost < (cost.get(key(point)) ?? Infinity)) { cost.set(key(point), nextCost); previous.set(key(point), current); if (!open.some((node) => key(node) === key(point))) open.push(point); }
    }
  }
  return null;
}

export function reserveRoute(reservations: Map<string, string>, agentId: string, route: GridPoint[]) {
  // Reserve only the next two cells. Full-route reservations deadlock narrow corridors.
  const cells = route.slice(1, 3).map(key);
  if (cells.some((cell) => reservations.has(cell) && reservations.get(cell) !== agentId)) return false;
  cells.forEach((cell) => reservations.set(cell, agentId));
  return true;
}

export function releaseReservation(reservations: Map<string, string>, agentId: string, cell: GridPoint) {
  if (reservations.get(key(cell)) === agentId) reservations.delete(key(cell));
}

export function releaseAgentReservations(reservations: Map<string, string>, agentId: string) {
  reservations.forEach((owner, cell) => { if (owner === agentId) reservations.delete(cell); });
}

export function reservedByOthers(reservations: ReadonlyMap<string, string>, agentId: string) {
  return new Set([...reservations].filter(([, owner]) => owner !== agentId).map(([cell]) => cell));
}

export const cellKey = key;
