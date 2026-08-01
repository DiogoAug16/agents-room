import { furnitureImage, furnitureOrigin, furnitureSeat, type FurnitureAsset, type FurnitureOrientation } from "../scene/furniture/catalog";

export type AssetEditorDocument = {
  assetId: string;
  orientation: FurnitureOrientation;
  image: string;
  origin: { x: number; y: number };
  footprint: Array<{ x: number; y: number }>;
  frontOcclusionStart?: number;
  seat?: { anchor: { x: number; y: number }; approach: { x: number; y: number }; facing: string; offset: { x: number; y: number } };
  interactionPoints: Array<{ id: string; offset: { x: number; y: number }; facing?: string; capacity: number; actionTypes: string[] }>;
};

export function assetEditorDocument(asset: FurnitureAsset, orientation: FurnitureOrientation): AssetEditorDocument {
  const seat = furnitureSeat(asset, orientation);
  return {
    assetId: asset.id,
    orientation,
    image: furnitureImage(asset, orientation),
    origin: { ...furnitureOrigin(asset, orientation) },
    footprint: asset.footprint.map((point) => ({ ...point })),
    frontOcclusionStart: asset.frontOcclusionStart,
    seat: seat && { anchor: { ...seat.anchor }, approach: { ...seat.approach }, facing: seat.facing, offset: { ...seat.offset } },
    interactionPoints: (asset.interactionPoints ?? []).map((point) => ({ id: point.id, offset: { ...point.offset }, facing: point.facing, capacity: point.capacity, actionTypes: [...point.actionTypes] })),
  };
}
