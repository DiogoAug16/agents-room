import { describe, expect, it } from "vitest";
import { FURNITURE_ASSETS, furnitureCells, furnitureImage, furnitureInteractionPoints, furnitureOrientations } from "./catalog";

describe("furniture catalog", () => {
  it("turns a furniture footprint into blocked grid cells", () => {
    expect([...furnitureCells([{ id: "desk-1", assetId: "desk.work.light.01", position: { x: 10, y: 10 }, orientation: "north_east", createdAt: "now" }]).keys()]).toEqual(["10,10", "11,10", "10,11", "11,11"]);
  });

  it("defines a front occlusion layer for every usable seat", () => {
    expect(FURNITURE_ASSETS.filter((asset) => asset.seat).every((asset) => asset.frontOcclusionStart !== undefined)).toBe(true);
  });

  it("keeps every floor furniture asset out of the navigation grid", () => {
    expect(FURNITURE_ASSETS.filter((asset) => !asset.surface).every((asset) => asset.footprint.length > 0)).toBe(true);
  });

  it("transforms interaction points with the furniture instance", () => {
    expect(furnitureInteractionPoints([{ id: "water-1", assetId: "water.dispenser.01", position: { x: 10, y: 20 }, orientation: "north_east", createdAt: "now" }])).toEqual([
      expect.objectContaining({ id: "furniture-water-1-water", gridPosition: { x: 10, y: 21 }, actionTypes: ["idle", "get_water"] }),
    ]);
  });

  it("uses only supplied images for supported orientations", () => {
    const desk = FURNITURE_ASSETS.find((asset) => asset.id === "desk.work.light.01")!;
    expect(furnitureOrientations(desk)).toEqual(["north_west", "south_west"]);
    expect(furnitureImage(desk, "south_west")).toContain("desk-work-light-sw-01.png");
  });
});
