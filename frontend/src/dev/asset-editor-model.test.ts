import { describe, expect, it } from "vitest";
import { FURNITURE_ASSETS } from "../scene/furniture/catalog";
import { assetEditorDocument } from "./asset-editor-model";

describe("asset editor document", () => {
  it("exports the orientation-specific seat calibration", () => {
    const chair = FURNITURE_ASSETS.find((asset) => asset.id === "chair.office.black.01")!;
    expect(assetEditorDocument(chair, "south_east")).toMatchObject({ assetId: chair.id, image: expect.stringContaining("chair-office-black-se"), seat: { approach: { x: -1, y: 0 }, facing: "east" } });
  });
});
