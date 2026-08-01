import { describe, expect, it } from "vitest";
import { preservesNavigationRoutes } from "./connectivity";
import { NavigationGrid } from "./navigation-grid";

describe("placement connectivity", () => {
  it("rejects a layout that blocks a required destination", () => {
    const navigation = new NavigationGrid();
    expect(preservesNavigationRoutes(navigation, [{ agentId: "ana", start: { x: 10, y: 25 }, destination: { x: 11, y: 16 } }])).toBe(true);
    navigation.setFurniture(new Map([["11,16", "preview-desk"]]));
    expect(preservesNavigationRoutes(navigation, [{ agentId: "ana", start: { x: 10, y: 25 }, destination: { x: 11, y: 16 } }])).toBe(false);
  });
});
