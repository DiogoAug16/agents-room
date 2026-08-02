import { furnitureImage, furnitureOrigin, furnitureSeat, type FurnitureAsset, type FurnitureOrientation } from "../scene/furniture/catalog";

export type AssetEditorSeat = { id?: string; anchor: { x: number; y: number }; approach: { x: number; y: number }; facing: string; offset: { x: number; y: number } };

export type AssetEditorDocument = {
  assetId: string;
  orientation: FurnitureOrientation;
  image: string;
  origin: { x: number; y: number };
  footprint: Array<{ x: number; y: number }>;
  frontOcclusionStart?: number;
  seat?: AssetEditorSeat;
  seats?: AssetEditorSeat[];
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
    seats: asset.seats?.map((item) => ({ id: item.id, anchor: { ...item.anchor }, approach: { ...item.approach }, facing: item.facing, offset: { ...item.offset } })),
    interactionPoints: (asset.interactionPoints ?? []).map((point) => ({ id: point.id, offset: { ...point.offset }, facing: point.facing, capacity: point.capacity, actionTypes: [...point.actionTypes] })),
  };
}
