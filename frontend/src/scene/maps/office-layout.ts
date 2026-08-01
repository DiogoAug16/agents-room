import type { Direction, GridPoint } from "../../types";
import { GRID_HEIGHT, GRID_WIDTH } from "../grid";

export type NavigationCellType = "walkable" | "corridor" | "work_area" | "meeting_area" | "rest_area" | "blocked" | "seat" | "interaction_point";
export type NavigationCell = { gridX: number; gridY: number; type: NavigationCellType; walkable: boolean; movementCost: number; objectId?: string };
export type SeatType = "office_chair" | "meeting_chair" | "sofa_seat" | "waiting_chair";
export type SeatAnchor = { id: string; type: SeatType; gridPosition: GridPoint; approachPosition: GridPoint; seatedSpriteOffset: GridPoint; facing: Direction; workstationId?: string; ownerAgentId?: string; depthOffset?: number };
export type CorridorArea = { id: string; cells: GridPoint[]; priority: number };
export type IdlePoint = { id: string; type: "corridor_pause" | "window_view" | "plant_area" | "water_cooler" | "sofa" | "meeting_point" | "workstation_wait"; gridPosition: GridPoint; facing?: Direction; capacity: number };
export type MeetingArea = { id: string; seatIds: string[]; standingPoints: GridPoint[]; maxParticipants: number };

const line = (from: GridPoint, to: GridPoint): GridPoint[] => {
  const cells: GridPoint[] = [];
  if (from.x === to.x) for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++) cells.push({ x: from.x, y });
  else for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) cells.push({ x, y: from.y });
  return cells;
};
const key = ({ x, y }: GridPoint) => `${x},${y}`;

export const CORRIDORS: CorridorArea[] = [
  { id: "main-east-west", cells: line({ x: 1, y: 9 }, { x: 22, y: 9 }), priority: 1 },
  { id: "main-north-south", cells: line({ x: 14, y: 2 }, { x: 14, y: 13 }), priority: 1 },
  { id: "left-access", cells: line({ x: 8, y: 3 }, { x: 8, y: 13 }), priority: 1 },
  { id: "south-access", cells: line({ x: 2, y: 12 }, { x: 21, y: 12 }), priority: 1 },
  { id: "meeting-access", cells: line({ x: 12, y: 5 }, { x: 12, y: 9 }), priority: 2 },
  { id: "window-access", cells: line({ x: 18, y: 4 }, { x: 18, y: 12 }), priority: 2 },
  { id: "lounge-access", cells: [...line({ x: 4, y: 12 }, { x: 4, y: 13 }), ...line({ x: 4, y: 13 }, { x: 7, y: 13 })], priority: 2 },
];

export const STATIC_OBSTACLES: GridPoint[] = [
  ...line({ x: 10, y: 7 }, { x: 13, y: 7 }), ...line({ x: 10, y: 8 }, { x: 13, y: 8 }),
  ...line({ x: 5, y: 5 }, { x: 7, y: 5 }), ...line({ x: 16, y: 5 }, { x: 17, y: 5 }),
  ...line({ x: 3, y: 14 }, { x: 7, y: 15 }),
  { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 18, y: 8 }, { x: 19, y: 8 },
];
export const WORK_AREA_CELLS: GridPoint[] = [...line({ x: 5, y: 8 }, { x: 19, y: 8 }), ...line({ x: 5, y: 11 }, { x: 19, y: 11 }), { x: 8, y: 7 }, { x: 14, y: 9 }, { x: 12, y: 6 }];

export const STATIC_SEATS: SeatAnchor[] = [
  { id: "meeting-north", type: "meeting_chair", gridPosition: { x: 12, y: 5 }, approachPosition: { x: 12, y: 6 }, seatedSpriteOffset: { x: 0, y: -18 }, facing: "north", depthOffset: -2 },
  { id: "meeting-east", type: "meeting_chair", gridPosition: { x: 15, y: 6 }, approachPosition: { x: 14, y: 6 }, seatedSpriteOffset: { x: -8, y: -13 }, facing: "west", depthOffset: -2 },
  { id: "sofa-bottom-left", type: "sofa_seat", gridPosition: { x: 4, y: 14 }, approachPosition: { x: 4, y: 13 }, seatedSpriteOffset: { x: -9, y: -18 }, facing: "north", depthOffset: -3 },
  { id: "sofa-bottom-center", type: "sofa_seat", gridPosition: { x: 5, y: 14 }, approachPosition: { x: 5, y: 13 }, seatedSpriteOffset: { x: 0, y: -19 }, facing: "north", depthOffset: -3 },
  { id: "sofa-bottom-right", type: "sofa_seat", gridPosition: { x: 6, y: 14 }, approachPosition: { x: 6, y: 13 }, seatedSpriteOffset: { x: 9, y: -18 }, facing: "north", depthOffset: -3 },
  { id: "waiting-window", type: "waiting_chair", gridPosition: { x: 18, y: 6 }, approachPosition: { x: 18, y: 7 }, seatedSpriteOffset: { x: 0, y: -15 }, facing: "north", depthOffset: -2 },
];

export const MEETING_AREAS: MeetingArea[] = [{ id: "lounge-sync", seatIds: ["sofa-bottom-left", "sofa-bottom-center", "sofa-bottom-right"], standingPoints: [{ x: 7, y: 13 }, { x: 8, y: 12 }], maxParticipants: 3 }];
export const IDLE_POINTS: IdlePoint[] = [
  { id: "window-view", type: "window_view", gridPosition: { x: 18, y: 4 }, facing: "north", capacity: 1 },
  { id: "water-cooler", type: "water_cooler", gridPosition: { x: 8, y: 12 }, facing: "east", capacity: 1 },
  { id: "plant-pause", type: "plant_area", gridPosition: { x: 4, y: 12 }, facing: "north", capacity: 1 },
  { id: "corridor-pause", type: "corridor_pause", gridPosition: { x: 14, y: 10 }, facing: "south", capacity: 1 },
  { id: "meeting-point", type: "meeting_point", gridPosition: { x: 12, y: 6 }, facing: "south", capacity: 2 },
];

export function homeSeatForAgent(agent: { id: string; basePosition: GridPoint }): SeatAnchor {
  const seat = agent.basePosition;
  return { id: `workstation-${agent.id}-seat`, type: "office_chair", gridPosition: seat, approachPosition: { x: seat.x, y: seat.y + 1 }, seatedSpriteOffset: { x: 0, y: -18 }, facing: "north", workstationId: `workstation-${agent.id}`, ownerAgentId: agent.id, depthOffset: -2 };
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
