import type { Direction, GridPoint } from "../../types";

export type FurnitureCategory = "chair" | "desk" | "monitor" | "sofa" | "plant" | "decoration" | "cabinet" | "shelf" | "whiteboard" | "equipment";
export type FurnitureOrientation = "north_east" | "north_west" | "south_east" | "south_west";
export type FurnitureInstance = { id: string; assetId: string; position: GridPoint; orientation: FurnitureOrientation; createdAt: string; groupId?: string; parentId?: string; surfaceOffset?: GridPoint };
export type AgentSeatAssignments = Record<string, string>;
export type FurnitureGroup = { id: string; name: string; instanceIds: string[]; groupType: "workstation" };
export type FurnitureInteractionPoint = { id: string; furnitureId: string; gridPosition: GridPoint; facing?: Direction; capacity: number; actionTypes: string[] };
export type FurnitureAsset = { id: string; name: string; category: FurnitureCategory; image: string; footprint: GridPoint[]; navigationPadding: number; orientations?: Partial<Record<FurnitureOrientation, string>>; defaultScale?: number; surface?: { hostCategories: FurnitureCategory[]; offset: GridPoint }; seat?: { anchor: GridPoint; approach: GridPoint; facing: Direction; offset: GridPoint }; interactionPoints?: Array<{ id: string; offset: GridPoint; facing?: Direction; capacity: number; actionTypes: string[] }>; frontOcclusionStart?: number; };

export const FURNITURE_ASSETS: FurnitureAsset[] = [
  { id: "chair.office.black.01", name: "Cadeira executiva", category: "chair", image: "office/generated/chairs/chair-office-black-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 0, seat: { anchor: { x: 0, y: 0 }, approach: { x: 0, y: 1 }, facing: "north", offset: { x: 0, y: -4 } }, frontOcclusionStart: 0.58 },
  { id: "desk.work.light.01", name: "Mesa de trabalho", category: "desk", image: "office/generated/desks/desk-work-light-01.png", orientations: { north_west: "office/generated/desks/desk-work-light-01.png", south_west: "office/generated/desks/desk-work-light-sw-01.png" }, footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], navigationPadding: 1 },
  { id: "monitor.black.01", name: "Monitor + teclado", category: "monitor", image: "office/generated/monitors/monitor-black-01.png", footprint: [], navigationPadding: 0, surface: { hostCategories: ["desk"], offset: { x: 8, y: -28 } } },
  { id: "sofa.blue.01", name: "Sofá azul", category: "sofa", image: "office/generated/sofas/sofa-blue-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], navigationPadding: 1, seat: { anchor: { x: 0, y: 0 }, approach: { x: 0, y: 1 }, facing: "south", offset: { x: 0, y: -6 } }, frontOcclusionStart: 0.5 },
  { id: "plant.floor.monstera.01", name: "Planta monstera", category: "plant", image: "office/generated/plants/plant-floor-monstera-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
  { id: "plant.desk.monstera.01", name: "Planta de mesa", category: "decoration", image: "office/generated/plants/plant-floor-monstera-01.png", footprint: [], navigationPadding: 0, defaultScale: 0.26, surface: { hostCategories: ["desk"], offset: { x: -18, y: -24 } } },
  { id: "cabinet.light.01", name: "Armário claro", category: "cabinet", image: "office/generated/cabinets/cabinet-light-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
  { id: "shelf.bookcase.01", name: "Estante de livros", category: "shelf", image: "office/generated/shelves/shelf-bookcase-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
  { id: "whiteboard.diagram.01", name: "Quadro branco", category: "whiteboard", image: "office/generated/whiteboards/whiteboard-diagram-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }], navigationPadding: 1, interactionPoints: [{ id: "presentation", offset: { x: -1, y: 1 }, facing: "north", capacity: 1, actionTypes: ["meeting", "presentation"] }] },
  { id: "water.dispenser.01", name: "Bebedouro", category: "equipment", image: "office/generated/equipment/water-dispenser-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1, interactionPoints: [{ id: "water", offset: { x: 0, y: 1 }, facing: "north", capacity: 1, actionTypes: ["idle", "get_water"] }] },
];

export const furnitureAsset = (id: string) => FURNITURE_ASSETS.find((asset) => asset.id === id);
export const furnitureOrientations = (asset: FurnitureAsset): FurnitureOrientation[] => {
  const orientations = Object.keys(asset.orientations ?? {}) as FurnitureOrientation[];
  return orientations.length ? orientations : ["north_east"];
};
export const furnitureTextureKey = (asset: FurnitureAsset, orientation: FurnitureOrientation) => `furniture-${asset.id}-${asset.orientations?.[orientation] ? orientation : furnitureOrientations(asset)[0]}`;
export const furnitureImage = (asset: FurnitureAsset, orientation: FurnitureOrientation) => asset.orientations?.[orientation] ?? asset.orientations?.[furnitureOrientations(asset)[0]] ?? asset.image;
export const defaultFurnitureOrientation = (assetId: string): FurnitureOrientation => { const asset = furnitureAsset(assetId); return asset ? furnitureOrientations(asset)[0] : "north_east"; };
export const furnitureCells = (items: FurnitureInstance[]) => new Map(items.flatMap((item) => {
  const asset = furnitureAsset(item.assetId); if (!asset) return [];
  return asset.footprint.map((offset) => [`${item.position.x + offset.x},${item.position.y + offset.y}`, item.id] as const);
}));
export const furnitureInteractionPoints = (items: FurnitureInstance[]): FurnitureInteractionPoint[] => items.flatMap((item) => {
  const points = furnitureAsset(item.assetId)?.interactionPoints ?? [];
  return points.map((point) => ({ id: `furniture-${item.id}-${point.id}`, furnitureId: item.id, gridPosition: { x: item.position.x + point.offset.x, y: item.position.y + point.offset.y }, facing: point.facing, capacity: point.capacity, actionTypes: point.actionTypes }));
});
