import type { GridPoint } from "../types";
import { isInsideGrid } from "./grid";
import { cellKey } from "./pathfinding";

export function isValidStationCell(cell: GridPoint, agentId: string, agents: ReadonlyArray<{ id: string; position: GridPoint }>, furnitureCells: ReadonlySet<string>) {
  return isInsideGrid(cell) && !furnitureCells.has(cellKey(cell)) && !agents.some((agent) => agent.id !== agentId && cellKey(agent.position) === cellKey(cell));
}
