import type { Direction, GridPoint } from "../../types";
import { GENERATED_FURNITURE_CALIBRATIONS } from "./generated-calibrations";

export type FurnitureCategory = "chair" | "desk" | "monitor" | "sofa" | "plant" | "decoration" | "cabinet" | "shelf" | "whiteboard" | "equipment" | "divider";
export type FurnitureOrientation = "north_east" | "north_west" | "south_east" | "south_west";
export type FurnitureInstance = { id: string; assetId: string; position: GridPoint; orientation: FurnitureOrientation; createdAt: string; groupId?: string; parentId?: string; surfaceOffset?: GridPoint };
export type AgentSeatAssignments = Record<string, string>;
export type FurnitureGroup = { id: string; name: string; instanceIds: string[]; groupType: "workstation" | "lounge" | "meeting" | "break_area" | "partition" | "custom" };
export type FurnitureInteractionPoint = { id: string; furnitureId: string; gridPosition: GridPoint; facing?: Direction; capacity: number; actionTypes: string[] };
export type FurnitureSeat = { id?: string; anchor: GridPoint; approach: GridPoint; facing: Direction; offset: GridPoint };
export type FurnitureAsset = { id: string; name: string; category: FurnitureCategory; image: string; footprint: GridPoint[]; navigationPadding: number; orientations?: Partial<Record<FurnitureOrientation, string>>; seatByOrientation?: Partial<Record<FurnitureOrientation, FurnitureSeat>>; originByOrientation?: Partial<Record<FurnitureOrientation, GridPoint>>; defaultScale?: number; surface?: { hostCategories: FurnitureCategory[]; offset: GridPoint }; seat?: FurnitureSeat; seats?: FurnitureSeat[]; interactionPoints?: Array<{ id: string; offset: GridPoint; offsets?: GridPoint[]; facing?: Direction; capacity: number; actionTypes: string[] }>; frontOcclusionStart?: number; };

type FurnitureCalibration = { originNormalized?: GridPoint; footprint?: GridPoint[]; seat?: FurnitureSeat; interactionPoints?: Array<{ id: string; offset: GridPoint; offsets?: GridPoint[]; facing?: Direction; capacity: number; actionTypes: string[] }>; frontOcclusionStart?: number };
type FurnitureCalibrations = Partial<Record<string, Partial<Record<FurnitureOrientation, FurnitureCalibration>>>>;

const BASE_FURNITURE_ASSETS: FurnitureAsset[] = [
  { id: "chair.office.black.01", name: "Cadeira executiva", category: "chair", image: "office/generated/chairs/chair-office-black-01.png", orientations: { north_east: "office/generated/chairs/chair-office-black-01.png", south_east: "office/generated/chairs/chair-office-black-se-01.png" }, footprint: [{ x: 0, y: 0 }], navigationPadding: 0, seat: { anchor: { x: 0, y: 0 }, approach: { x: 0, y: 1 }, facing: "north", offset: { x: 0, y: -4 } }, seatByOrientation: { south_east: { anchor: { x: 0, y: 0 }, approach: { x: -1, y: 0 }, facing: "east", offset: { x: -2, y: -3 } } }, frontOcclusionStart: 0.58 },
  { id: "chair.office.blue.01", name: "Cadeira azul", category: "chair", image: "office/generated/chairs/chair-office-blue-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 0, seat: { anchor: { x: 0, y: 0 }, approach: { x: 0, y: 1 }, facing: "north", offset: { x: 0, y: -4 } }, frontOcclusionStart: 0.58 },
  { id: "desk.work.light.01", name: "Mesa de trabalho", category: "desk", image: "office/generated/desks/desk-work-light-01.png", orientations: { north_west: "office/generated/desks/desk-work-light-01.png", south_west: "office/generated/desks/desk-work-light-sw-01.png" }, footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], navigationPadding: 1 },
  { id: "desk.meeting.l.01", name: "Mesa de reunião em L", category: "desk", image: "office/generated/desks/desk-meeting-l-01.png", orientations: { north_east: "office/generated/desks/desk-meeting-l-01.png", south_east: "office/generated/desks/desk-meeting-l-se-01.png" }, footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], navigationPadding: 1, interactionPoints: [{ id: "meeting", offset: { x: 1, y: 2 }, offsets: [{ x: 1, y: 2 }, { x: 2, y: 2 }], facing: "north", capacity: 2, actionTypes: ["meeting", "idle"] }] },
  { id: "monitor.black.01", name: "Monitor + teclado", category: "monitor", image: "office/generated/monitors/monitor-black-01.png", footprint: [], navigationPadding: 0, surface: { hostCategories: ["desk"], offset: { x: 8, y: -28 } } },
  { id: "sofa.blue.01", name: "Sofá azul", category: "sofa", image: "office/generated/sofas/sofa-blue-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }], navigationPadding: 1, seats: [{ id: "left", anchor: { x: 0, y: 0 }, approach: { x: 0, y: 1 }, facing: "south", offset: { x: -8, y: -6 } }, { id: "right", anchor: { x: 1, y: 0 }, approach: { x: 1, y: 1 }, facing: "south", offset: { x: 8, y: -6 } }], frontOcclusionStart: 0.5 },
  { id: "sofa.light.01", name: "Sofá claro", category: "sofa", image: "office/generated/sofas/sofa-light-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], navigationPadding: 1, seats: [{ id: "left", anchor: { x: 0, y: 0 }, approach: { x: 0, y: 1 }, facing: "south", offset: { x: -12, y: -6 } }, { id: "center", anchor: { x: 1, y: 0 }, approach: { x: 1, y: 1 }, facing: "south", offset: { x: 0, y: -6 } }, { id: "right", anchor: { x: 2, y: 0 }, approach: { x: 2, y: 1 }, facing: "south", offset: { x: 12, y: -6 } }], frontOcclusionStart: 0.5 },
  { id: "plant.floor.monstera.01", name: "Planta monstera", category: "plant", image: "office/generated/plants/plant-floor-monstera-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
  { id: "plant.floor.palm.01", name: "Palmeira de piso", category: "plant", image: "office/generated/plants/plant-floor-palm-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
  { id: "plant.desk.monstera.01", name: "Planta de mesa", category: "decoration", image: "office/generated/plants/plant-floor-monstera-01.png", footprint: [], navigationPadding: 0, defaultScale: 0.26, surface: { hostCategories: ["desk"], offset: { x: -18, y: -24 } } },
  { id: "cabinet.light.01", name: "Armário claro", category: "cabinet", image: "office/generated/cabinets/cabinet-light-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
  { id: "shelf.bookcase.01", name: "Estante de livros", category: "shelf", image: "office/generated/shelves/shelf-bookcase-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
  { id: "shelf.white.01", name: "Estante clara", category: "shelf", image: "office/generated/shelves/shelf-white-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1 },
  { id: "whiteboard.diagram.01", name: "Quadro branco", category: "whiteboard", image: "office/generated/whiteboards/whiteboard-diagram-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }], navigationPadding: 1, interactionPoints: [{ id: "presentation", offset: { x: -1, y: 1 }, facing: "north", capacity: 1, actionTypes: ["meeting", "presentation"] }] },
  { id: "water.dispenser.01", name: "Bebedouro", category: "equipment", image: "office/generated/equipment/water-dispenser-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1, interactionPoints: [{ id: "water", offset: { x: 0, y: 1 }, facing: "north", capacity: 1, actionTypes: ["idle", "get_water"] }] },
  { id: "recycling.station.01", name: "Estação de reciclagem", category: "equipment", image: "office/generated/equipment/recycling-station-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }], navigationPadding: 1, interactionPoints: [{ id: "recycle", offset: { x: 0, y: 1 }, facing: "north", capacity: 1, actionTypes: ["idle", "recycle"] }] },
  { id: "coffee.station.01", name: "Estação de café", category: "equipment", image: "office/generated/equipment/coffee-station-01.png", footprint: [{ x: 0, y: 0 }], navigationPadding: 1, interactionPoints: [{ id: "coffee", offset: { x: 0, y: 1 }, facing: "north", capacity: 1, actionTypes: ["idle", "get_coffee"] }] },
  { id: "divider.glass.01", name: "Divisória de vidro", category: "divider", image: "office/generated/dividers/divider-glass-01.png", orientations: { north_east: "office/generated/dividers/divider-glass-01.png", south_east: "office/generated/dividers/divider-glass-se-01.png" }, footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }], navigationPadding: 1 },
  { id: "divider.planter.01", name: "Jardineira divisória", category: "divider", image: "office/generated/dividers/divider-planter-01.png", footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], navigationPadding: 1 },
];

const calibrations = GENERATED_FURNITURE_CALIBRATIONS as FurnitureCalibrations;
const calibratedAsset = (asset: FurnitureAsset): FurnitureAsset => {
  const byOrientation = calibrations[asset.id];
  if (!byOrientation) return asset;
  const defaultOrientation = (Object.keys(asset.orientations ?? {})[0] ?? "north_east") as FurnitureOrientation;
  const defaultCalibration = byOrientation[defaultOrientation];
  return {
    ...asset,
    footprint: defaultCalibration?.footprint ?? asset.footprint,
    interactionPoints: defaultCalibration?.interactionPoints ?? asset.interactionPoints,
    frontOcclusionStart: defaultCalibration?.frontOcclusionStart ?? asset.frontOcclusionStart,
    originByOrientation: { ...asset.originByOrientation, ...Object.fromEntries(Object.entries(byOrientation).flatMap(([orientation, value]) => value?.originNormalized ? [[orientation, value.originNormalized]] : [])) },
    seatByOrientation: { ...asset.seatByOrientation, ...Object.fromEntries(Object.entries(byOrientation).flatMap(([orientation, value]) => value?.seat ? [[orientation, value.seat]] : [])) },
  };
};

export const FURNITURE_ASSETS = BASE_FURNITURE_ASSETS.map(calibratedAsset);

export const furnitureAsset = (id: string) => FURNITURE_ASSETS.find((asset) => asset.id === id);
export const furnitureOrientations = (asset: FurnitureAsset): FurnitureOrientation[] => {
  const orientations = Object.keys(asset.orientations ?? {}) as FurnitureOrientation[];
  return orientations.length ? orientations : ["north_east"];
};
export const furnitureTextureKey = (asset: FurnitureAsset, orientation: FurnitureOrientation) => `furniture-${asset.id}-${asset.orientations?.[orientation] ? orientation : furnitureOrientations(asset)[0]}`;
export const furnitureImage = (asset: FurnitureAsset, orientation: FurnitureOrientation) => asset.orientations?.[orientation] ?? asset.orientations?.[furnitureOrientations(asset)[0]] ?? asset.image;
export const furnitureOrigin = (asset: FurnitureAsset, orientation: FurnitureOrientation) => asset.originByOrientation?.[orientation] ?? { x: 0.5, y: 0.85 };
export const defaultFurnitureOrientation = (assetId: string): FurnitureOrientation => { const asset = furnitureAsset(assetId); return asset ? furnitureOrientations(asset)[0] : "north_east"; };
export const furnitureSeat = (asset: FurnitureAsset, orientation: FurnitureOrientation) => asset.seatByOrientation?.[orientation] ?? asset.seat;
export const furnitureSeats = (asset: FurnitureAsset) => asset.seats ?? (asset.seat ? [{ id: "seat", ...asset.seat }] : []);
export const highlightedFurnitureIds = (items: FurnitureInstance[], groups: FurnitureGroup[], selectedId: string | undefined, selectedIds: string[]) => {
  const group = groups.find((value) => value.id === items.find((item) => item.id === selectedId)?.groupId);
  return group ? group.instanceIds : selectedIds;
};
export const assignedAgentIdForFurnitureGroup = (group: FurnitureGroup, assignments: AgentSeatAssignments) => Object.entries(assignments).find(([, seatId]) => group.instanceIds.includes(seatId))?.[0];
export const linkedFurnitureIds = (items: FurnitureInstance[], id: string) => {
  const pivot = items.find((item) => item.id === id); if (!pivot) return new Set<string>();
  const ids = new Set(items.filter((item) => item.id === id || (pivot.groupId && item.groupId === pivot.groupId)).map((item) => item.id));
  let changed = true;
  while (changed) {
    changed = false;
    items.filter((item) => item.parentId && ids.has(item.parentId) && !ids.has(item.id)).forEach((item) => { ids.add(item.id); changed = true; });
  }
  return ids;
};
export const movedFurnitureInstances = (items: FurnitureInstance[], id: string, position: GridPoint, ids = linkedFurnitureIds(items, id)) => {
  const pivot = items.find((item) => item.id === id); if (!pivot) return undefined;
  const delta = { x: position.x - pivot.position.x, y: position.y - pivot.position.y };
  return items.map((item) => ids.has(item.id) ? { ...item, position: { x: item.position.x + delta.x, y: item.position.y + delta.y } } : item);
};
export const duplicatedFurnitureInstances = (items: FurnitureInstance[], groups: FurnitureGroup[], id: string, position: GridPoint) => {
  const pivot = items.find((item) => item.id === id); if (!pivot) return undefined;
  const ids = linkedFurnitureIds(items, id), sourceGroup = groups.find((group) => group.id === pivot.groupId);
  const clonedIds = new Map([...ids].map((itemId) => [itemId, crypto.randomUUID()])), groupId = sourceGroup ? crypto.randomUUID() : undefined;
  const delta = { x: position.x - pivot.position.x, y: position.y - pivot.position.y }, createdAt = new Date().toISOString();
  const furniture = items.filter((item) => ids.has(item.id)).map((item) => ({ ...item, id: clonedIds.get(item.id)!, position: { x: item.position.x + delta.x, y: item.position.y + delta.y }, createdAt, groupId, parentId: item.parentId ? clonedIds.get(item.parentId) : undefined }));
  const group = sourceGroup && { ...sourceGroup, id: groupId!, name: `${sourceGroup.name} cópia`, instanceIds: sourceGroup.instanceIds.map((itemId) => clonedIds.get(itemId)!) };
  return { furniture, group, selectedFurnitureId: clonedIds.get(id)! };
};
export const removableFurnitureIds = (items: FurnitureInstance[], id: string) => {
  const pivot = items.find((item) => item.id === id);
  if (!pivot) return new Set<string>();
  if (!pivot.parentId) return linkedFurnitureIds(items, id);
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    items.filter((item) => item.parentId && ids.has(item.parentId) && !ids.has(item.id)).forEach((item) => { ids.add(item.id); changed = true; });
  }
  return ids;
};
export const furnitureCells = (items: FurnitureInstance[]) => new Map(items.flatMap((item) => {
  const asset = furnitureAsset(item.assetId); if (!asset) return [];
  return asset.footprint.map((offset) => [`${item.position.x + offset.x},${item.position.y + offset.y}`, item.id] as const);
}));
export const furnitureNavigationCells = (items: FurnitureInstance[]) => {
  const cells: Map<string, string> = new Map(furnitureCells(items));
  items.forEach((item) => {
    const asset = furnitureAsset(item.assetId); if (!asset?.navigationPadding) return;
    const approaches = new Set([
      ...furnitureSeats(asset).map((seat) => `${item.position.x + seat.approach.x},${item.position.y + seat.approach.y}`),
      ...(asset.interactionPoints ?? []).flatMap((point) => (point.offsets?.length ? point.offsets : [point.offset]).map((offset) => `${item.position.x + offset.x},${item.position.y + offset.y}`)),
    ]);
    asset.footprint.forEach((offset) => {
      for (let x = -asset.navigationPadding; x <= asset.navigationPadding; x++) for (let y = -asset.navigationPadding; y <= asset.navigationPadding; y++) {
        const cell = `${item.position.x + offset.x + x},${item.position.y + offset.y + y}`;
        if (!approaches.has(cell) && !cells.has(cell)) cells.set(cell, `${item.id}:clearance`);
      }
    });
  });
  return cells;
};
export const furnitureGroupCenter = (items: FurnitureInstance[], ids: Iterable<string>): GridPoint | undefined => {
  const selected = new Set(ids);
  const selectedItems = items.filter((item) => selected.has(item.id));
  const points = selectedItems.flatMap((item) => (furnitureAsset(item.assetId)?.footprint ?? []).map((offset) => ({ x: item.position.x + offset.x, y: item.position.y + offset.y })));
  if (!points.length) points.push(...selectedItems.map((item) => item.position));
  if (!points.length) return undefined;
  return { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
};
export const furnitureInteractionPoints = (items: FurnitureInstance[]): FurnitureInteractionPoint[] => items.flatMap((item) => {
  const points = furnitureAsset(item.assetId)?.interactionPoints ?? [];
  return points.flatMap((point) => {
    const offsets = point.offsets?.length ? point.offsets : [point.offset];
    return offsets.map((offset, index) => ({ id: `furniture-${item.id}-${point.id}${offsets.length > 1 ? `-${index + 1}` : ""}`, furnitureId: item.id, gridPosition: { x: item.position.x + offset.x, y: item.position.y + offset.y }, facing: point.facing, capacity: 1, actionTypes: point.actionTypes }));
  });
});
