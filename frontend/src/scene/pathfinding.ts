import type { GridPoint } from "../types";
import { GRID_HEIGHT, GRID_WIDTH, isInsideGrid } from "./grid";
import type { NavigationGrid } from "./maps/navigation-grid";

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

export function findNavigationPath(start: GridPoint, goal: GridPoint, navigation: NavigationGrid, agentId: string, blocked: ReadonlySet<string>): GridPoint[] | null {
  if (!navigation.canEnter(goal, agentId, blocked)) return null;
  const open = [start]; const previous = new Map<string, GridPoint>(); const cost = new Map([[key(start), 0]]);
  while (open.length) {
    open.sort((a, b) => (cost.get(key(a))! + distance(a, goal)) - (cost.get(key(b))! + distance(b, goal)));
    const current = open.shift()!;
    if (key(current) === key(goal)) { const path = [current]; while (previous.has(key(path[0]))) path.unshift(previous.get(key(path[0]))!); return path; }
    for (const next of [{ x: current.x, y: current.y - 1 }, { x: current.x + 1, y: current.y }, { x: current.x, y: current.y + 1 }, { x: current.x - 1, y: current.y }]) {
      if (!isInsideGrid(next) || !navigation.canEnter(next, agentId, blocked)) continue;
      const nextCost = cost.get(key(current))! + navigation.movementCost(next);
      if (nextCost < (cost.get(key(next)) ?? Infinity)) { cost.set(key(next), nextCost); previous.set(key(next), current); if (!open.some((node) => key(node) === key(next))) open.push(next); }
    }
  }
  return null;
}

export function reserveRoute(reservations: Map<string, string>, agentId: string, route: GridPoint[]) {
  const cells = route.slice(1).map(key);
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
