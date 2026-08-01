import type { Direction, GridPoint } from "../../types";

export type FurnitureCategory = "chair" | "desk" | "monitor" | "sofa" | "plant";
export type FurnitureOrientation = "north_east" | "north_west" | "south_east" | "south_west";
export type FurnitureInstance = { id: string; assetId: string; position: GridPoint; orientation: FurnitureOrientation; createdAt: string; groupId?: string; parentId?: string };
export type AgentSeatAssignments = Record<string, string>;
export type FurnitureGroup = { id: string; name: string; instanceIds: string[]; groupType: "workstation" };
export type FurnitureAsset = { id: string; name: string; category: FurnitureCategory; image: string; footprint: GridPoint[]; navigationPadding: number; seat?: { anchor: GridPoint; approach: GridPoint; facing: Direction; offset: GridPoint }; frontOcclusionStart?: number; };

export const FURNITURE_ASSETS: FurnitureAsset[] = [
  { id: "chair.office.black.01", name: "Cadeira executiva", category: "chair", image: "office/generated/chairs/chair-office-black-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 0, seat: { anchor: { x: 0, y: 0 }, approach: { x: 0, y: 1 }, facing: "north", offset: { x: 0, y: -4 } }, frontOcclusionStart: 0.58 },
  { id: "desk.work.light.01", name: "Mesa de trabalho", category: "desk", image: "office/generated/desks/desk-work-light-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], navigationPadding: 1 },
  { id: "monitor.black.01", name: "Monitor preto", category: "monitor", image: "office/generated/monitors/monitor-black-01.png", footprint: [], navigationPadding: 0 },
  { id: "sofa.blue.01", name: "Sofá azul", category: "sofa", image: "office/generated/sofas/sofa-blue-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], navigationPadding: 1, seat: { anchor: { x: 0, y: 0 }, approach: { x: 0, y: 1 }, facing: "south", offset: { x: 0, y: -6 } }, frontOcclusionStart: 0.5 },
  { id: "plant.floor.monstera.01", name: "Planta monstera", category: "plant", image: "office/generated/plants/plant-floor-monstera-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
];

export const furnitureAsset = (id: string) => FURNITURE_ASSETS.find((asset) => asset.id === id);
export const furnitureCells = (items: FurnitureInstance[]) => new Map(items.flatMap((item) => {
  const asset = furnitureAsset(item.assetId); if (!asset) return [];
  return asset.footprint.map((offset) => [`${item.position.x + offset.x},${item.position.y + offset.y}`, item.id] as const);
}));
