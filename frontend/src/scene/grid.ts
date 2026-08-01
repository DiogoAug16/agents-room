import type { GridPoint } from "../types";

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const GRID_WIDTH = 40;
// The annotated office includes the two front lounge seats at rows 38 and 40.
export const GRID_HEIGHT = 42;
// Calibrated from the supplied green-path annotation, in scene world coordinates.
export const ORIGIN = { x: 1200, y: 150 };

export function gridToScreen({ x, y }: GridPoint) {
  return { x: ORIGIN.x + (x - y) * TILE_WIDTH / 2, y: ORIGIN.y + (x + y) * TILE_HEIGHT / 2 };
}

export function screenToGrid(screenX: number, screenY: number): GridPoint {
  const relativeX = screenX - ORIGIN.x;
  const relativeY = screenY - ORIGIN.y;
  return {
    x: Math.round((relativeX / (TILE_WIDTH / 2) + relativeY / (TILE_HEIGHT / 2)) / 2),
    y: Math.round((relativeY / (TILE_HEIGHT / 2) - relativeX / (TILE_WIDTH / 2)) / 2),
  };
}

export function isInsideGrid({ x, y }: GridPoint) {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}
