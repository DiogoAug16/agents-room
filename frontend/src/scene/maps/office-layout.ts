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

const key = ({ x, y }: GridPoint) => `${x},${y}`;
const routeSegment = (from: GridPoint, to: GridPoint): GridPoint[] => {
  const cells: GridPoint[] = []; let x = from.x; let y = from.y;
  const stepX = Math.sign(to.x - from.x); const stepY = Math.sign(to.y - from.y);
  while (x !== to.x || y !== to.y) {
    cells.push({ x, y });
    if (x !== to.x) { x += stepX; cells.push({ x, y }); }
    if (y !== to.y) y += stepY;
  }
  return [...cells, { ...to }];
};
const route = (...points: GridPoint[]): GridPoint[] => points.flatMap((point, index) => index ? routeSegment(points[index - 1], point).slice(1) : [point]);

// Calibrated once from the supplied annotated office image: green traces are the
// only routes and pink marks are non-walkable chairs. No art pixels are inspected.
// Calibrated from assets/cenario_pathfinding_anotado.png. These are the green
// routes only. Every cell outside this network is blocked by default, which
// keeps desks, walls, planters, shelves and sofas out of A* without inspecting
// image pixels at runtime.
export const CORRIDORS: CorridorArea[] = [
  { id: "left-desks", priority: 1, cells: route({ x: 4, y: 24 }, { x: 7, y: 24 }, { x: 10, y: 25 }, { x: 11, y: 20 }, { x: 11, y: 16 }) },
  { id: "meeting-table", priority: 1, cells: route({ x: 3, y: 13 }, { x: 5, y: 15 }, { x: 11, y: 16 }, { x: 13, y: 13 }, { x: 11, y: 8 }) },
  { id: "central-corridor", priority: 1, cells: route({ x: 11, y: 20 }, { x: 15, y: 18 }, { x: 20, y: 12 }, { x: 22, y: 17 }, { x: 22, y: 23 }) },
  { id: "right-desks", priority: 1, cells: route({ x: 20, y: 12 }, { x: 29, y: 14 }, { x: 31, y: 12 }, { x: 31, y: 22 }, { x: 22, y: 23 }) },
  { id: "lounge-access", priority: 1, cells: route({ x: 10, y: 25 }, { x: 8, y: 30 }, { x: 5, y: 34 }, { x: 8, y: 35 }, { x: 12, y: 35 }, { x: 12, y: 40 }, { x: 16, y: 37 }) },
  { id: "window-access", priority: 2, cells: route({ x: 13, y: 13 }, { x: 15, y: 11 }, { x: 20, y: 12 }) },
];

export const STATIC_OBSTACLES: GridPoint[] = [];

export const WORKSTATIONS: WorkstationAnchor[] = [
  { id: "C01", gridPosition: { x: 4, y: 23 }, approachPosition: { x: 4, y: 24 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "C02", gridPosition: { x: 10, y: 23 }, approachPosition: { x: 10, y: 25 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "C03", gridPosition: { x: 3, y: 11 }, approachPosition: { x: 3, y: 13 }, seatedSpriteOffset: { x: -2, y: -4 }, facing: "east" },
  { id: "C04", gridPosition: { x: 6, y: 13 }, approachPosition: { x: 5, y: 15 }, seatedSpriteOffset: { x: -3, y: -4 }, facing: "east" },
  { id: "C05", gridPosition: { x: 10, y: 14 }, approachPosition: { x: 11, y: 16 }, seatedSpriteOffset: { x: 2, y: -4 }, facing: "west" },
  { id: "C06", gridPosition: { x: 10, y: 12 }, approachPosition: { x: 13, y: 13 }, seatedSpriteOffset: { x: 3, y: -4 }, facing: "west" },
  { id: "C07", gridPosition: { x: 9, y: 8 }, approachPosition: { x: 11, y: 8 }, seatedSpriteOffset: { x: 3, y: -5 }, facing: "west" },
  { id: "C08", gridPosition: { x: 20, y: 10 }, approachPosition: { x: 20, y: 12 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "C09", gridPosition: { x: 22, y: 21 }, approachPosition: { x: 22, y: 23 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "C10", gridPosition: { x: 31, y: 10 }, approachPosition: { x: 31, y: 12 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
  { id: "C11", gridPosition: { x: 29, y: 13 }, approachPosition: { x: 29, y: 14 }, seatedSpriteOffset: { x: 3, y: -4 }, facing: "west" },
  { id: "C12", gridPosition: { x: 31, y: 20 }, approachPosition: { x: 31, y: 22 }, seatedSpriteOffset: { x: 0, y: -5 }, facing: "north" },
];
export const WORKSTATION_CELLS = WORKSTATIONS.map((anchor) => anchor.gridPosition);
export const WORK_AREA_CELLS = WORKSTATIONS.map((anchor) => anchor.approachPosition);

export const STATIC_SEATS: SeatAnchor[] = [
  { id: "S01", type: "sofa_seat", gridPosition: { x: 5, y: 32 }, approachPosition: { x: 5, y: 34 }, seatedSpriteOffset: { x: -4, y: -6 }, facing: "south", depthOffset: -3 },
  { id: "S02", type: "sofa_seat", gridPosition: { x: 8, y: 32 }, approachPosition: { x: 8, y: 35 }, seatedSpriteOffset: { x: -2, y: -6 }, facing: "south", depthOffset: -3 },
  { id: "S03", type: "sofa_seat", gridPosition: { x: 10, y: 33 }, approachPosition: { x: 12, y: 35 }, seatedSpriteOffset: { x: 0, y: -6 }, facing: "south", depthOffset: -3 },
  { id: "S04", type: "sofa_seat", gridPosition: { x: 11, y: 38 }, approachPosition: { x: 12, y: 40 }, seatedSpriteOffset: { x: 1, y: -6 }, facing: "south", depthOffset: -3 },
  { id: "S05", type: "sofa_seat", gridPosition: { x: 15, y: 35 }, approachPosition: { x: 16, y: 37 }, seatedSpriteOffset: { x: 4, y: -6 }, facing: "south", depthOffset: -3 },
];

export const MEETING_AREAS: MeetingArea[] = [{ id: "lounge-sync", seatIds: ["S01", "S02", "S03", "S04", "S05"], standingPoints: [{ x: 8, y: 30 }, { x: 12, y: 35 }], maxParticipants: 3 }];
export const IDLE_POINTS: IdlePoint[] = [
  { id: "left-pause", type: "corridor_pause", gridPosition: { x: 7, y: 24 }, facing: "east", capacity: 1 },
  { id: "water-cooler", type: "water_cooler", gridPosition: { x: 11, y: 20 }, facing: "east", capacity: 1 },
  { id: "meeting-pause", type: "meeting_point", gridPosition: { x: 15, y: 18 }, facing: "north", capacity: 1 },
  { id: "window-pause", type: "window_view", gridPosition: { x: 20, y: 12 }, facing: "north", capacity: 1 },
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
  WORKSTATIONS.forEach((seat) => cells.set(key(seat.gridPosition), { gridX: seat.gridPosition.x, gridY: seat.gridPosition.y, type: "seat", walkable: false, movementCost: Infinity, objectId: seat.id }));
  STATIC_SEATS.forEach((seat) => cells.set(key(seat.gridPosition), { gridX: seat.gridPosition.x, gridY: seat.gridPosition.y, type: "seat", walkable: false, movementCost: Infinity, objectId: seat.id }));
  return [...cells.values()];
}
