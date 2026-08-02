import { describe, expect, it } from "vitest";
import { FURNITURE_ASSETS, assignedAgentIdForFurnitureGroup, furnitureCells, furnitureGroupCenter, furnitureImage, furnitureInteractionPoints, furnitureNavigationCells, furnitureOrientations, furnitureSeat, furnitureSeats, highlightedFurnitureIds, movedFurnitureInstances, removableFurnitureIds } from "./catalog";

describe("furniture catalog", () => {
  it("turns a furniture footprint into blocked grid cells", () => {
    expect([...furnitureCells([{ id: "desk-1", assetId: "desk.work.light.01", position: { x: 10, y: 10 }, orientation: "north_east", createdAt: "now" }]).keys()]).toEqual(["10,10", "11,10", "10,11", "11,11"]);
  });

  it("blocks corridor cells for modular dividers", () => {
    expect([...furnitureCells([{ id: "divider-1", assetId: "divider.glass.01", position: { x: 10, y: 20 }, orientation: "north_east", createdAt: "now" }]).keys()]).toEqual(["10,20", "11,20"]);
  });

  it("adds clearance around furniture without blocking its approach point", () => {
    const cells = furnitureNavigationCells([{ id: "sofa-1", assetId: "sofa.blue.01", position: { x: 10, y: 20 }, orientation: "north_east", createdAt: "now" }]);
    expect(cells.get("9,19")).toBe("sofa-1:clearance");
    expect(cells.get("10,21")).toBeUndefined();
    expect(cells.get("11,21")).toBeUndefined();
  });

  it("defines a front occlusion layer for every usable seat", () => {
    expect(FURNITURE_ASSETS.filter((asset) => furnitureSeats(asset).length).every((asset) => asset.frontOcclusionStart !== undefined)).toBe(true);
  });

  it("keeps every floor furniture asset out of the navigation grid", () => {
    expect(FURNITURE_ASSETS.filter((asset) => !asset.surface).every((asset) => asset.footprint.length > 0)).toBe(true);
  });

  it("transforms interaction points with the furniture instance", () => {
    expect(furnitureInteractionPoints([{ id: "water-1", assetId: "water.dispenser.01", position: { x: 10, y: 20 }, orientation: "north_east", createdAt: "now" }, { id: "coffee-1", assetId: "coffee.station.01", position: { x: 12, y: 20 }, orientation: "north_east", createdAt: "now" }])).toEqual([
      expect.objectContaining({ id: "furniture-water-1-water", gridPosition: { x: 10, y: 21 }, actionTypes: ["idle", "get_water"] }),
      expect.objectContaining({ id: "furniture-coffee-1-coffee", gridPosition: { x: 12, y: 21 }, actionTypes: ["idle", "get_coffee"] }),
    ]);
  });

  it("expands interaction capacity into distinct reservable cells", () => {
    const points = furnitureInteractionPoints([{ id: "recycling-1", assetId: "recycling.station.01", position: { x: 10, y: 20 }, orientation: "north_east", createdAt: "now" }, { id: "meeting-1", assetId: "desk.meeting.l.01", position: { x: 20, y: 12 }, orientation: "north_east", createdAt: "now" }]);
    expect(points).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "furniture-recycling-1-recycle", gridPosition: { x: 10, y: 21 }, actionTypes: ["idle", "recycle"] }),
      expect.objectContaining({ id: "furniture-meeting-1-meeting-1", gridPosition: { x: 21, y: 14 }, capacity: 1 }),
      expect.objectContaining({ id: "furniture-meeting-1-meeting-2", gridPosition: { x: 22, y: 14 }, capacity: 1 }),
    ]));
  });

  it("uses only supplied images for supported orientations", () => {
    const desk = FURNITURE_ASSETS.find((asset) => asset.id === "desk.work.light.01")!;
    expect(furnitureOrientations(desk)).toEqual(["north_west", "south_west"]);
    expect(furnitureImage(desk, "south_west")).toContain("desk-work-light-sw-01.png");
  });

  it("calibrates chair seats by the selected orientation", () => {
    const chair = FURNITURE_ASSETS.find((asset) => asset.id === "chair.office.black.01")!;
    expect(furnitureSeat(chair, "south_east")).toMatchObject({ approach: { x: -1, y: 0 }, facing: "east", offset: { x: -2, y: -3 } });
  });

  it("registers the expanded modular catalog with independent sofa seats", () => {
    expect(FURNITURE_ASSETS.map((asset) => asset.id)).toEqual(expect.arrayContaining(["chair.office.blue.01", "sofa.light.01", "plant.floor.palm.01", "shelf.white.01", "desk.meeting.l.01", "recycling.station.01", "coffee.station.01", "divider.glass.01", "divider.planter.01"]));
    expect(furnitureSeats(FURNITURE_ASSETS.find((asset) => asset.id === "sofa.light.01")!)).toHaveLength(3);
  });

  it("keeps the two sofa seats independent", () => {
    const sofa = FURNITURE_ASSETS.find((asset) => asset.id === "sofa.blue.01")!;
    expect(furnitureSeats(sofa)).toMatchObject([{ id: "left", approach: { x: 0, y: 1 } }, { id: "right", approach: { x: 1, y: 1 } }]);
  });

  it("moves a furniture group together with surface attachments", () => {
    const items = [{ id: "desk", assetId: "desk.work.light.01", position: { x: 10, y: 20 }, orientation: "north_west" as const, createdAt: "now", groupId: "station" }, { id: "monitor", assetId: "monitor.black.01", position: { x: 10, y: 20 }, orientation: "north_east" as const, createdAt: "now", groupId: "station", parentId: "desk", surfaceOffset: { x: 8, y: -28 } }];
    expect(movedFurnitureInstances(items, "desk", { x: 12, y: 21 })?.map((item) => item.position)).toEqual([{ x: 12, y: 21 }, { x: 12, y: 21 }]);
  });

  it("highlights every member of the group containing the active furniture", () => {
    const items = [{ id: "desk", assetId: "desk.work.light.01", position: { x: 10, y: 20 }, orientation: "north_west" as const, createdAt: "now", groupId: "station" }, { id: "chair", assetId: "chair.office.black.01", position: { x: 10, y: 23 }, orientation: "north_east" as const, createdAt: "now", groupId: "station" }];
    expect(highlightedFurnitureIds(items, [{ id: "station", name: "Estação", instanceIds: ["desk", "chair"], groupType: "workstation" }], "chair", ["chair"])).toEqual(["desk", "chair"]);
  });

  it("finds the agent assigned to a workstation chair", () => {
    const group = { id: "station", name: "Estação", instanceIds: ["desk", "chair"], groupType: "workstation" as const };
    expect(assignedAgentIdForFurnitureGroup(group, { ana: "chair", bruno: "other-chair" })).toBe("ana");
  });

  it("finds the visual center of a furniture group from its footprints", () => {
    const items = [{ id: "desk", assetId: "desk.work.light.01", position: { x: 10, y: 20 }, orientation: "north_west" as const, createdAt: "now" }, { id: "chair", assetId: "chair.office.black.01", position: { x: 10, y: 23 }, orientation: "north_east" as const, createdAt: "now" }];
    expect(furnitureGroupCenter(items, ["desk", "chair"])).toEqual({ x: 10.4, y: 21 });
  });

  it("removes a full group with its attached surface objects", () => {
    const items = [{ id: "desk", assetId: "desk.work.light.01", position: { x: 10, y: 20 }, orientation: "north_west" as const, createdAt: "now", groupId: "station" }, { id: "chair", assetId: "chair.office.black.01", position: { x: 10, y: 23 }, orientation: "north_east" as const, createdAt: "now", groupId: "station" }, { id: "monitor", assetId: "monitor.black.01", position: { x: 10, y: 20 }, orientation: "north_east" as const, createdAt: "now", groupId: "station", parentId: "desk", surfaceOffset: { x: 8, y: -28 } }];
    expect(removableFurnitureIds(items, "desk")).toEqual(new Set(["desk", "chair", "monitor"]));
  });
});
