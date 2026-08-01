import type { Direction, GridPoint } from "../../types";
import { GRID_HEIGHT, GRID_WIDTH } from "../grid";

export type NavigationCellType = "walkable" | "corridor" | "work_area" | "meeting_area" | "rest_area" | "blocked" | "seat" | "interaction_point";
export type NavigationCell = { gridX: number; gridY: number; type: NavigationCellType; walkable: boolean; movementCost: number; objectId?: string };
export type SeatType = "office_chair" | "meeting_chair" | "sofa_seat" | "waiting_chair";
export type SeatAnchor = { id: string; type: SeatType; gridPosition: GridPoint; approachPosition: GridPoint; seatedSpriteOffset: GridPoint; facing: Direction; workstationId?: string; ownerAgentId?: string; depthOffset?: number };
export type CorridorArea = { id: string; cells: GridPoint[]; priority: number };
export type IdlePoint = { id: string; type: "corridor_pause" | "window_view" | "plant_area" | "water_cooler" | "sofa" | "meeting_point" | "workstation_wait"; gridPosition: GridPoint; facing?: Direction; capacity: number };
export type MeetingArea = { id: string; seatIds: string[]; standingPoints: GridPoint[]; maxParticipants: number };
export type WorkstationAnchor = { id: string; gridPosition: GridPoint; approachPosition: GridPoint; seatedSpriteOffset: GridPoint; facing: Direction };

const line = (from: GridPoint, to: GridPoint): GridPoint[] => {
  const cells: GridPoint[] = [];
  if (from.x === to.x) for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++) cells.push({ x: from.x, y });
  else if (from.y === to.y) for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) cells.push({ x, y: from.y });
  else throw new Error("Corridors must use cardinal grid segments");
  return cells;
};
const key = ({ x, y }: GridPoint) => `${x},${y}`;

// Calibrated once from the supplied annotated office image: green traces are the
// only routes and pink marks are non-walkable chairs. No art pixels are inspected.
export const CORRIDORS: CorridorArea[] = [
  { id: "left-workspace", priority: 1, cells: [...line({ x: 3, y: 19 }, { x: 3, y: 23 }), ...line({ x: 3, y: 19 }, { x: 8, y: 19 }), ...line({ x: 8, y: 18 }, { x: 8, y: 19 }), ...line({ x: 8, y: 18 }, { x: 11, y: 18 })] },
  { id: "meeting-perimeter", priority: 1, cells: [...line({ x: 5, y: 9 }, { x: 5, y: 14 }), ...line({ x: 5, y: 9 }, { x: 11, y: 9 }), ...line({ x: 11, y: 9 }, { x: 11, y: 14 }), ...line({ x: 8, y: 14 }, { x: 11, y: 14 })] },
  { id: "central-corridor", priority: 1, cells: [...line({ x: 11, y: 14 }, { x: 14, y: 14 }), ...line({ x: 14, y: 14 }, { x: 14, y: 18 }), ...line({ x: 11, y: 18 }, { x: 14, y: 18 }), ...line({ x: 11, y: 14 }, { x: 11, y: 24 })] },
  { id: "lounge-corridor", priority: 1, cells: [...line({ x: 5, y: 24 }, { x: 11, y: 24 }), ...line({ x: 5, y: 24 }, { x: 5, y: 30 }), ...line({ x: 5, y: 30 }, { x: 13, y: 30 }), ...line({ x: 9, y: 30 }, { x: 9, y: 34 }), ...line({ x: 10, y: 30 }, { x: 10, y: 31 }), ...line({ x: 13, y: 30 }, { x: 13, y: 32 })] },
  { id: "right-corridor", priority: 1, cells: [...line({ x: 14, y: 14 }, { x: 21, y: 14 }), ...line({ x: 21, y: 7 }, { x: 21, y: 14 }), ...line({ x: 21, y: 7 }, { x: 25, y: 7 }), ...line({ x: 21, y: 14 }, { x: 25, y: 14 })] },
  { id: "south-east-corridor", priority: 1, cells: [...line({ x: 21, y: 14 }, { x: 21, y: 21 }), ...line({ x: 21, y: 21 }, { x: 32, y: 21 }), ...line({ x: 27, y: 21 }, { x: 27, y: 29 }), ...line({ x: 27, y: 29 }, { x: 34, y: 29 })] },
  { id: "window-access", priority: 2, cells: [...line({ x: 14, y: 9 }, { x: 14, y: 14 }), ...line({ x: 14, y: 9 }, { x: 21, y: 9 })] },
];

export const STATIC_OBSTACLES: GridPoint[] = [];

export const WORKSTATIONS: WorkstationAnchor[] = [
  { id: "desk-left-top", gridPosition: { x: 5, y: 23 }, approachPosition: { x: 5, y: 24 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "desk-left-bottom", gridPosition: { x: 11, y: 23 }, approachPosition: { x: 11, y: 24 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "meeting-south", gridPosition: { x: 11, y: 13 }, approachPosition: { x: 11, y: 14 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "meeting-left", gridPosition: { x: 5, y: 13 }, approachPosition: { x: 5, y: 14 }, seatedSpriteOffset: { x: -4, y: -4 }, facing: "east" },
  { id: "meeting-east", gridPosition: { x: 11, y: 10 }, approachPosition: { x: 11, y: 9 }, seatedSpriteOffset: { x: 4, y: -4 }, facing: "west" },
  { id: "desk-right-top", gridPosition: { x: 21, y: 5 }, approachPosition: { x: 21, y: 6 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "desk-right-middle", gridPosition: { x: 22, y: 12 }, approachPosition: { x: 21, y: 12 }, seatedSpriteOffset: { x: 3, y: -5 }, facing: "west" },
  { id: "desk-south", gridPosition: { x: 32, y: 21 }, approachPosition: { x: 32, y: 22 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
];
export const WORKSTATION_CELLS = WORKSTATIONS.map((anchor) => anchor.gridPosition);
export const WORK_AREA_CELLS = WORKSTATIONS.map((anchor) => anchor.approachPosition);

export const STATIC_SEATS: SeatAnchor[] = [
  { id: "sofa-left", type: "sofa_seat", gridPosition: { x: 9, y: 35 }, approachPosition: { x: 9, y: 34 }, seatedSpriteOffset: { x: -6, y: -6 }, facing: "south", depthOffset: -3 },
  { id: "sofa-center", type: "sofa_seat", gridPosition: { x: 10, y: 32 }, approachPosition: { x: 10, y: 31 }, seatedSpriteOffset: { x: 0, y: -6 }, facing: "south", depthOffset: -3 },
  { id: "sofa-right", type: "sofa_seat", gridPosition: { x: 13, y: 32 }, approachPosition: { x: 13, y: 31 }, seatedSpriteOffset: { x: 6, y: -6 }, facing: "south", depthOffset: -3 },
];

export const MEETING_AREAS: MeetingArea[] = [{ id: "lounge-sync", seatIds: ["sofa-left", "sofa-center", "sofa-right"], standingPoints: [{ x: 11, y: 30 }, { x: 13, y: 30 }], maxParticipants: 3 }];
export const IDLE_POINTS: IdlePoint[] = [
  { id: "left-pause", type: "corridor_pause", gridPosition: { x: 8, y: 19 }, facing: "east", capacity: 1 },
  { id: "water-cooler", type: "water_cooler", gridPosition: { x: 14, y: 18 }, facing: "east", capacity: 1 },
  { id: "meeting-pause", type: "meeting_point", gridPosition: { x: 14, y: 14 }, facing: "north", capacity: 1 },
  { id: "window-pause", type: "window_view", gridPosition: { x: 21, y: 9 }, facing: "north", capacity: 1 },
];

export function homeSeatForAgent(agent: { id: string; basePosition: GridPoint }): SeatAnchor {
  const anchor = WORKSTATIONS.find((item) => item.gridPosition.x === agent.basePosition.x && item.gridPosition.y === agent.basePosition.y);
  const fallback = { id: "unmapped", gridPosition: agent.basePosition, approachPosition: { x: agent.basePosition.x, y: agent.basePosition.y + 1 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" as Direction };
  const seat = anchor ?? fallback;
  return { id: `workstation-${agent.id}-seat`, type: "office_chair", gridPosition: seat.gridPosition, approachPosition: seat.approachPosition, seatedSpriteOffset: seat.seatedSpriteOffset, facing: seat.facing, workstationId: seat.id, ownerAgentId: agent.id, depthOffset: -2 };
}

export const staticObstacleKeys = new Set(STATIC_OBSTACLES.map(key));
export function buildNavigationCells(): NavigationCell[] {
  const cells = new Map<string, NavigationCell>();
  for (let x = 0; x < GRID_WIDTH; x++) for (let y = 0; y < GRID_HEIGHT; y++) cells.set(`${x},${y}`, { gridX: x, gridY: y, type: "blocked", walkable: false, movementCost: Infinity });
  WORK_AREA_CELLS.forEach((point) => cells.set(key(point), { gridX: point.x, gridY: point.y, type: "work_area", walkable: true, movementCost: 2, objectId: "workstation-approach" }));
  CORRIDORS.forEach((area) => area.cells.forEach((point) => cells.set(key(point), { gridX: point.x, gridY: point.y, type: "corridor", walkable: true, movementCost: area.priority === 1 ? 1 : 2, objectId: area.id })));
  IDLE_POINTS.forEach((point) => cells.set(key(point.gridPosition), { gridX: point.gridPosition.x, gridY: point.gridPosition.y, type: "rest_area", walkable: true, movementCost: 3, objectId: point.id }));
  STATIC_SEATS.forEach((seat) => cells.set(key(seat.gridPosition), { gridX: seat.gridPosition.x, gridY: seat.gridPosition.y, type: "seat", walkable: false, movementCost: Infinity, objectId: seat.id }));
  return [...cells.values()];
}
