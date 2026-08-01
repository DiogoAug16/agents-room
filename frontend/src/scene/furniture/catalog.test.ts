import { describe, expect, it } from "vitest";
import { FURNITURE_ASSETS, furnitureCells } from "./catalog";

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
});
