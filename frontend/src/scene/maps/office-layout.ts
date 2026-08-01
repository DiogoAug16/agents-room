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
  else for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) cells.push({ x, y: from.y });
  return cells;
};
const key = ({ x, y }: GridPoint) => `${x},${y}`;

export const CORRIDORS: CorridorArea[] = [
  { id: "meeting-access", cells: line({ x: 7, y: 5 }, { x: 7, y: 13 }), priority: 1 },
  { id: "meeting-chair-access", cells: [...line({ x: 7, y: 3 }, { x: 7, y: 5 }), ...line({ x: 7, y: 3 }, { x: 9, y: 3 }), ...line({ x: 9, y: 3 }, { x: 9, y: 4 })], priority: 1 },
  { id: "central-desk-access", cells: line({ x: 14, y: 9 }, { x: 14, y: 13 }), priority: 1 },
  { id: "main-access", cells: line({ x: 7, y: 13 }, { x: 15, y: 13 }), priority: 1 },
  { id: "south-access", cells: line({ x: 15, y: 13 }, { x: 15, y: 20 }), priority: 1 },
  { id: "lounge-access", cells: [...line({ x: 8, y: 20 }, { x: 15, y: 20 }), ...line({ x: 8, y: 20 }, { x: 8, y: 21 })], priority: 1 },
  { id: "sofa-center-access", cells: [...line({ x: 10, y: 19 }, { x: 10, y: 20 }), ...line({ x: 10, y: 20 }, { x: 15, y: 20 })], priority: 2 },
  { id: "sofa-right-access", cells: [...line({ x: 12, y: 17 }, { x: 12, y: 20 }), ...line({ x: 12, y: 20 }, { x: 15, y: 20 })], priority: 2 },
];

export const STATIC_OBSTACLES: GridPoint[] = [
  ...line({ x: 8, y: 5 }, { x: 12, y: 5 }), { x: 8, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 },
  ...line({ x: 8, y: 10 }, { x: 12, y: 10 }), ...line({ x: 17, y: 8 }, { x: 21, y: 8 }),
  ...line({ x: 7, y: 22 }, { x: 13, y: 23 }),
];
export const WORKSTATIONS: WorkstationAnchor[] = [
  { id: "desk-left-lower", gridPosition: { x: 9, y: 12 }, approachPosition: { x: 9, y: 13 }, seatedSpriteOffset: { x: 0, y: -2 }, facing: "north" },
  { id: "meeting-left", gridPosition: { x: 10, y: 4 }, approachPosition: { x: 9, y: 4 }, seatedSpriteOffset: { x: 0, y: -4 }, facing: "north" },
  { id: "desk-center", gridPosition: { x: 15, y: 10 }, approachPosition: { x: 15, y: 11 }, seatedSpriteOffset: { x: 0, y: -4 }, facing: "north" },
  { id: "desk-right", gridPosition: { x: 19, y: 10 }, approachPosition: { x: 19, y: 11 }, seatedSpriteOffset: { x: 0, y: -4 }, facing: "north" },
  { id: "desk-lounge", gridPosition: { x: 13, y: 16 }, approachPosition: { x: 13, y: 17 }, seatedSpriteOffset: { x: 0, y: -4 }, facing: "north" },
  { id: "desk-south", gridPosition: { x: 16, y: 14 }, approachPosition: { x: 16, y: 15 }, seatedSpriteOffset: { x: 0, y: -4 }, facing: "north" },
  { id: "desk-sofa", gridPosition: { x: 11, y: 18 }, approachPosition: { x: 11, y: 19 }, seatedSpriteOffset: { x: 0, y: -4 }, facing: "north" },
  { id: "desk-window", gridPosition: { x: 16, y: 12 }, approachPosition: { x: 16, y: 13 }, seatedSpriteOffset: { x: 0, y: -4 }, facing: "north" },
];
export const WORKSTATION_CELLS: GridPoint[] = WORKSTATIONS.map((anchor) => anchor.gridPosition);
export const WORK_AREA_CELLS: GridPoint[] = WORKSTATIONS.map((anchor) => anchor.approachPosition);

export const STATIC_SEATS: SeatAnchor[] = [
  { id: "meeting-north", type: "meeting_chair", gridPosition: { x: 7, y: 4 }, approachPosition: { x: 7, y: 5 }, seatedSpriteOffset: { x: 0, y: -8 }, facing: "north", depthOffset: -2 },
  { id: "meeting-east", type: "meeting_chair", gridPosition: { x: 13, y: 7 }, approachPosition: { x: 13, y: 8 }, seatedSpriteOffset: { x: -6, y: -8 }, facing: "west", depthOffset: -2 },
  { id: "sofa-bottom-left", type: "sofa_seat", gridPosition: { x: 8, y: 22 }, approachPosition: { x: 8, y: 21 }, seatedSpriteOffset: { x: -7, y: -9 }, facing: "north", depthOffset: -3 },
  { id: "sofa-bottom-center", type: "sofa_seat", gridPosition: { x: 10, y: 20 }, approachPosition: { x: 10, y: 19 }, seatedSpriteOffset: { x: 0, y: -9 }, facing: "north", depthOffset: -3 },
  { id: "sofa-bottom-right", type: "sofa_seat", gridPosition: { x: 12, y: 18 }, approachPosition: { x: 12, y: 17 }, seatedSpriteOffset: { x: 7, y: -9 }, facing: "north", depthOffset: -3 },
  { id: "waiting-window", type: "waiting_chair", gridPosition: { x: 15, y: 10 }, approachPosition: { x: 15, y: 11 }, seatedSpriteOffset: { x: 0, y: -8 }, facing: "north", depthOffset: -2 },
];

export const MEETING_AREAS: MeetingArea[] = [{ id: "lounge-sync", seatIds: ["sofa-bottom-left", "sofa-bottom-center", "sofa-bottom-right"], standingPoints: [{ x: 11, y: 20 }, { x: 13, y: 20 }], maxParticipants: 3 }];
export const IDLE_POINTS: IdlePoint[] = [
  { id: "water-cooler", type: "water_cooler", gridPosition: { x: 15, y: 16 }, facing: "east", capacity: 1 },
  { id: "plant-pause", type: "plant_area", gridPosition: { x: 9, y: 20 }, facing: "north", capacity: 1 },
  { id: "corridor-pause", type: "corridor_pause", gridPosition: { x: 14, y: 13 }, facing: "south", capacity: 1 },
  { id: "meeting-point", type: "meeting_point", gridPosition: { x: 13, y: 20 }, facing: "south", capacity: 1 },
];

export function homeSeatForAgent(agent: { id: string; basePosition: GridPoint }): SeatAnchor {
  const anchor = WORKSTATIONS.find((item) => item.gridPosition.x === agent.basePosition.x && item.gridPosition.y === agent.basePosition.y);
  const seat = anchor ?? { id: "fallback", gridPosition: agent.basePosition, approachPosition: { x: agent.basePosition.x, y: agent.basePosition.y + 1 }, seatedSpriteOffset: { x: 0, y: -4 }, facing: "north" as Direction };
  return { id: `workstation-${agent.id}-seat`, type: "office_chair", gridPosition: seat.gridPosition, approachPosition: seat.approachPosition, seatedSpriteOffset: seat.seatedSpriteOffset, facing: seat.facing, workstationId: `workstation-${agent.id}`, ownerAgentId: agent.id, depthOffset: -2 };
}

export const staticObstacleKeys = new Set(STATIC_OBSTACLES.map(key));
export function buildNavigationCells(): NavigationCell[] {
  const cells = new Map<string, NavigationCell>();
  for (let x = 0; x < GRID_WIDTH; x++) for (let y = 0; y < GRID_HEIGHT; y++) cells.set(`${x},${y}`, { gridX: x, gridY: y, type: "blocked", walkable: false, movementCost: Infinity });
  WORK_AREA_CELLS.forEach((point) => cells.set(key(point), { gridX: point.x, gridY: point.y, type: "work_area", walkable: true, movementCost: 2, objectId: "workstation-access" }));
  CORRIDORS.forEach((area) => area.cells.forEach((point) => cells.set(key(point), { gridX: point.x, gridY: point.y, type: "corridor", walkable: true, movementCost: area.priority === 1 ? 1 : 2, objectId: area.id })));
  IDLE_POINTS.forEach((point) => cells.set(key(point.gridPosition), { gridX: point.gridPosition.x, gridY: point.gridPosition.y, type: "rest_area", walkable: true, movementCost: 3, objectId: point.id }));
  STATIC_OBSTACLES.forEach((point) => cells.set(key(point), { gridX: point.x, gridY: point.y, type: "blocked", walkable: false, movementCost: Infinity, objectId: "furniture" }));
  STATIC_SEATS.forEach((seat) => cells.set(key(seat.gridPosition), { gridX: seat.gridPosition.x, gridY: seat.gridPosition.y, type: "seat", walkable: false, movementCost: Infinity, objectId: seat.id }));
  return [...cells.values()];
}
