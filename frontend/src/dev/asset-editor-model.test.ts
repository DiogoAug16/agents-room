import { describe, expect, it } from "vitest";
import { FURNITURE_ASSETS } from "../scene/furniture/catalog";
import { assetEditorDocument } from "./asset-editor-model";

describe("asset editor document", () => {
  it("exports the orientation-specific seat calibration", () => {
    const chair = FURNITURE_ASSETS.find((asset) => asset.id === "chair.office.black.01")!;
    expect(assetEditorDocument(chair, "south_east")).toMatchObject({ assetId: chair.id, image: expect.stringContaining("chair-office-black-se"), seat: { approach: { x: -1, y: 0 }, facing: "east" }, frontOcclusionStart: 0.58 });
  });

  it("exports every independent sofa seat", () => {
    const sofa = FURNITURE_ASSETS.find((asset) => asset.id === "sofa.light.01")!;
    expect(assetEditorDocument(sofa, "north_east").seats).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "left", approach: { x: 0, y: 1 }, facing: "south" }),
      expect.objectContaining({ id: "center", approach: { x: 1, y: 1 }, facing: "south" }),
      expect.objectContaining({ id: "right", approach: { x: 2, y: 1 }, facing: "south" }),
    ]));
    expect(assetEditorDocument(sofa, "north_east").frontOcclusionStart).toBe(0.5);
  });
});
