import type { GridPoint } from "../../types";
import { gridToScreen } from "../grid";
import type { SeatAnchor } from "./office-layout";

export class SeatRegistry {
  private readonly states = new Map<string, { occupiedByAgentId?: string; reservedByAgentId?: string; expiresAt?: number }>();
  reserve(seat: SeatAnchor, agentId: string, ttlMs = 15_000) { this.expire(); const state = this.states.get(seat.id); if ((seat.ownerAgentId && seat.ownerAgentId !== agentId) || (state?.occupiedByAgentId && state.occupiedByAgentId !== agentId) || (state?.reservedByAgentId && state.reservedByAgentId !== agentId)) return false; this.states.set(seat.id, { ...state, reservedByAgentId: agentId, expiresAt: Date.now() + ttlMs }); return true; }
  occupy(seat: SeatAnchor, agentId: string) { if (!this.reserve(seat, agentId)) return false; this.states.set(seat.id, { occupiedByAgentId: agentId }); return true; }
  release(seat: SeatAnchor, agentId: string) { const state = this.states.get(seat.id); if (state?.occupiedByAgentId === agentId || state?.reservedByAgentId === agentId) this.states.delete(seat.id); }
  occupiedBy(seatId: string) { this.expire(); return this.states.get(seatId)?.occupiedByAgentId; }
  expire(now = Date.now()) { this.states.forEach((state, id) => { if (state.expiresAt && state.expiresAt <= now) this.states.delete(id); }); }
}
export function seatedWorldPosition(seat: SeatAnchor) { const world = gridToScreen(seat.gridPosition); return { x: world.x + seat.seatedSpriteOffset.x, y: world.y + seat.seatedSpriteOffset.y + (seat.depthOffset ?? 0) }; }
export function seatApproachWorldPosition(seat: SeatAnchor) { return gridToScreen(seat.approachPosition); }
export function sameGridPoint(a: GridPoint, b: GridPoint) { return a.x === b.x && a.y === b.y; }
