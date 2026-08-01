import { describe, expect, it } from "vitest";
import { furnitureCells } from "./catalog";

describe("furniture catalog", () => {
  it("turns a furniture footprint into blocked grid cells", () => {
    expect([...furnitureCells([{ id: "desk-1", assetId: "desk.work.light.01", position: { x: 10, y: 10 }, orientation: "north_east", createdAt: "now" }]).keys()]).toEqual(["10,10", "11,10", "10,11", "11,11"]);
  });
});
