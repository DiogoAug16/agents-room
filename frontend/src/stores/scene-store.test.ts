import { beforeEach, describe, expect, it } from "vitest";
import { furnitureCells } from "../scene/furniture/catalog";
import { useSceneStore } from "./scene-store";

describe("furniture editor history", () => {
  beforeEach(() => useSceneStore.getState().replaceOfficeLayout([], [], {}));

  it("undoes and redoes a furniture insertion", () => {
    const store = useSceneStore.getState();
    store.addFurniture("chair.office.black.01", { x: 10, y: 20 });
    expect(useSceneStore.getState().furniture).toHaveLength(1);
    useSceneStore.getState().undoFurniture();
    expect(useSceneStore.getState().furniture).toEqual([]);
    useSceneStore.getState().redoFurniture();
    expect(useSceneStore.getState().furniture).toHaveLength(1);
  });

  it("keeps an explicit chair assignment independent from agent coordinates", () => {
    const store = useSceneStore.getState();
    store.assignAgentSeat("ana", "chair-ana");
    expect(useSceneStore.getState().agentSeatAssignments).toEqual({ ana: "chair-ana" });
    store.assignAgentSeat("ana");
    expect(useSceneStore.getState().agentSeatAssignments).toEqual({});
  });

  it("creates and moves a complete workstation as one group", () => {
    const store = useSceneStore.getState();
    expect(store.createWorkstationPreset("ana", { x: 10, y: 23 })).toBe(true);
    const { furniture, furnitureGroups, agentSeatAssignments } = useSceneStore.getState();
    expect(furniture).toHaveLength(3);
    expect(furniture.map((item) => item.assetId)).toEqual(["desk.work.light.01", "chair.office.black.01", "monitor.black.01"]);
    expect(furnitureGroups[0].instanceIds).toHaveLength(3);
    expect(agentSeatAssignments.ana).toBe(furniture.find((item) => item.assetId === "chair.office.black.01")?.id);
    expect(useSceneStore.getState().selectedFurnitureId).toBe(furniture.find((item) => item.assetId === "desk.work.light.01")?.id);
    const chair = furniture.find((item) => item.assetId === "chair.office.black.01")!;
    store.moveFurniture(chair.id, { x: 11, y: 24 });
    expect(useSceneStore.getState().furniture.map((item) => item.position)).toEqual([{ x: 11, y: 22 }, { x: 11, y: 24 }, { x: 11, y: 22 }]);
  });

  it("attaches surface objects to a desk without creating floor collision", () => {
    const store = useSceneStore.getState();
    store.addFurniture("desk.work.light.01", { x: 10, y: 20 });
    const desk = useSceneStore.getState().furniture[0];
    expect(store.addSurfaceFurniture("plant.desk.monstera.01", desk.id)).toBe(true);
    const plant = useSceneStore.getState().furniture[1];
    expect(plant).toMatchObject({ parentId: desk.id, position: { x: 10, y: 20 }, surfaceOffset: { x: -18, y: -24 } });
    expect([...furnitureCells(useSceneStore.getState().furniture).values()]).not.toContain(plant.id);
    store.moveFurniture(desk.id, { x: 11, y: 21 });
    expect(useSceneStore.getState().furniture[1].position).toEqual({ x: 11, y: 21 });
  });

  it("removes attached surface objects with their desk", () => {
    const store = useSceneStore.getState();
    store.addFurniture("desk.work.light.01", { x: 10, y: 20 });
    const desk = useSceneStore.getState().furniture[0];
    store.addSurfaceFurniture("plant.desk.monstera.01", desk.id);
    store.removeFurniture(desk.id);
    expect(useSceneStore.getState().furniture).toEqual([]);
  });

  it("rotates only furniture with a supplied visual variant", () => {
    const store = useSceneStore.getState();
    store.addFurniture("desk.work.light.01", { x: 10, y: 20 });
    const desk = useSceneStore.getState().furniture[0];
    expect(desk.orientation).toBe("north_west");
    store.rotateFurniture(desk.id);
    expect(useSceneStore.getState().furniture[0].orientation).toBe("south_west");
    store.addFurniture("water.dispenser.01", { x: 12, y: 20 });
    const water = useSceneStore.getState().furniture[1];
    store.rotateFurniture(water.id);
    expect(useSceneStore.getState().furniture[1].orientation).toBe("north_east");
    store.addFurniture("chair.office.black.01", { x: 14, y: 20 });
    const chair = useSceneStore.getState().furniture[2];
    store.rotateFurniture(chair.id);
    expect(useSceneStore.getState().furniture[2].orientation).toBe("south_east");
  });
});
