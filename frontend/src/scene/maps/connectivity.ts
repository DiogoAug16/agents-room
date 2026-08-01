import type { GridPoint } from "../../types";
import { findNavigationPath } from "../pathfinding";
import type { NavigationGrid } from "./navigation-grid";

export function preservesNavigationRoutes(navigation: NavigationGrid, routes: Array<{ agentId: string; start: GridPoint; destination: GridPoint }>) {
  return routes.every((route) => Boolean(findNavigationPath(route.start, route.destination, navigation, route.agentId, new Set())));
}
