import { beforeEach, describe, expect, it } from "vitest";
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
    const chair = furniture.find((item) => item.assetId === "chair.office.black.01")!;
    store.moveFurniture(chair.id, { x: 11, y: 24 });
    expect(useSceneStore.getState().furniture.map((item) => item.position)).toEqual([{ x: 11, y: 22 }, { x: 11, y: 24 }, { x: 11, y: 22 }]);
  });
});
