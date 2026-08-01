import type { GridPoint } from "../../types";
import { cellKey } from "../pathfinding";
import { buildNavigationCells, type NavigationCell } from "./office-layout";

export class NavigationGrid {
  private cells = new Map(buildNavigationCells().map((cell) => [`${cell.gridX},${cell.gridY}`, { ...cell }]));
  private readonly reservations = new Map<string, { agentId: string; expiresAt: number }>();
  private readonly occupants = new Map<string, string>();
  cellAt(point: GridPoint): NavigationCell | undefined { return this.cells.get(cellKey(point)); }
  canEnter(point: GridPoint, agentId: string, blocked: ReadonlySet<string> = new Set()): boolean {
    this.expire(); const cell = this.cellAt(point); const occupant = this.occupants.get(cellKey(point)); const reservation = this.reservations.get(cellKey(point));
    return Boolean(cell?.walkable) && !blocked.has(cellKey(point)) && (!occupant || occupant === agentId) && (!reservation || reservation.agentId === agentId);
  }
  movementCost(point: GridPoint) { return this.cellAt(point)?.movementCost ?? Infinity; }
  reserve(point: GridPoint, agentId: string, ttlMs = 10_000) { if (!this.canEnter(point, agentId)) return false; this.reservations.set(cellKey(point), { agentId, expiresAt: Date.now() + ttlMs }); return true; }
  release(point: GridPoint, agentId: string) { if (this.reservations.get(cellKey(point))?.agentId === agentId) this.reservations.delete(cellKey(point)); }
  occupy(point: GridPoint, agentId: string) { const occupant = this.occupants.get(cellKey(point)); if (occupant && occupant !== agentId) return false; this.occupants.set(cellKey(point), agentId); return true; }
  vacate(point: GridPoint, agentId: string) { if (this.occupants.get(cellKey(point)) === agentId) this.occupants.delete(cellKey(point)); }
  expire(now = Date.now()) { this.reservations.forEach((value, key) => { if (value.expiresAt <= now) this.reservations.delete(key); }); }
  allCells() { return [...this.cells.values()]; }
  setFurniture(furniture: ReadonlyMap<string, string>) { this.cells = new Map(buildNavigationCells(furniture).map((cell) => [`${cell.gridX},${cell.gridY}`, { ...cell }])); this.reservations.clear(); }
  reservedCells() { this.expire(); return new Set(this.reservations.keys()); }
}
