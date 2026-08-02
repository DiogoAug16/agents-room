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

  it("places a catalog item only on a free floor cell", () => {
    const store = useSceneStore.getState();
    store.startFurniturePlacement("chair.office.black.01");
    expect(store.placeFurniture({ x: 10, y: 20 })).toBe(true);
    expect(useSceneStore.getState().placingFurnitureAssetId).toBeUndefined();
    store.startFurniturePlacement("chair.office.black.01");
    expect(store.placeFurniture({ x: 10, y: 20 })).toBe(false);
    expect(useSceneStore.getState().placingFurnitureAssetId).toBe("chair.office.black.01");
  });

  it("rotates a pending placement using only its supplied variants", () => {
    const store = useSceneStore.getState();
    store.startFurniturePlacement("chair.office.black.01");
    store.rotateFurniturePlacement();
    expect(useSceneStore.getState().placingFurnitureOrientation).toBe("south_east");
    expect(store.placeFurniture({ x: 10, y: 20 })).toBe(true);
    expect(useSceneStore.getState().furniture[0].orientation).toBe("south_east");
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

  it("creates a workstation with two independent monitors", () => {
    const store = useSceneStore.getState();
    expect(store.createWorkstationPreset("ana", { x: 10, y: 23 }, 2)).toBe(true);
    const { furniture, furnitureGroups } = useSceneStore.getState();
    const monitors = furniture.filter((item) => item.assetId === "monitor.black.01");
    expect(monitors).toHaveLength(2);
    expect(monitors.map((item) => item.surfaceOffset)).toEqual([{ x: 8, y: -28 }, { x: -18, y: -28 }]);
    expect(furnitureGroups[0].instanceIds).toEqual(furniture.map((item) => item.id));
  });

  it("restores one default workstation for each current agent", () => {
    const store = useSceneStore.getState();
    store.addFurniture("water.dispenser.01", { x: 14, y: 20 });
    expect(store.restoreDefaultFurniture()).toBe(true);
    const { agents, furniture, furnitureGroups, agentSeatAssignments } = useSceneStore.getState();
    expect(furniture).toHaveLength(agents.length * 3);
    expect(furnitureGroups).toHaveLength(agents.length);
    expect(Object.keys(agentSeatAssignments)).toEqual(agents.map((agent) => agent.id));
    expect(furnitureGroups.every((group) => group.groupType === "workstation" && group.instanceIds.length === 3)).toBe(true);
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

  it("keeps a surface object inside its workstation group", () => {
    const store = useSceneStore.getState();
    expect(store.createWorkstationPreset("ana", { x: 10, y: 23 })).toBe(true);
    const desk = useSceneStore.getState().furniture.find((item) => item.assetId === "desk.work.light.01")!;
    expect(store.addSurfaceFurniture("plant.desk.monstera.01", desk.id)).toBe(true);
    const { furniture, furnitureGroups } = useSceneStore.getState();
    const plant = furniture.find((item) => item.assetId === "plant.desk.monstera.01")!;
    expect(plant.groupId).toBe(desk.groupId);
    expect(furnitureGroups[0].instanceIds).toContain(plant.id);
  });

  it("removes attached surface objects with their desk", () => {
    const store = useSceneStore.getState();
    store.addFurniture("desk.work.light.01", { x: 10, y: 20 });
    const desk = useSceneStore.getState().furniture[0];
    store.addSurfaceFurniture("plant.desk.monstera.01", desk.id);
    store.removeFurniture(desk.id);
    expect(useSceneStore.getState().furniture).toEqual([]);
  });

  it("removes a surface object without removing its workstation", () => {
    const store = useSceneStore.getState();
    expect(store.createWorkstationPreset("ana", { x: 10, y: 23 })).toBe(true);
    const monitor = useSceneStore.getState().furniture.find((item) => item.assetId === "monitor.black.01")!;
    store.removeFurniture(monitor.id);
    const { furniture, furnitureGroups, agentSeatAssignments } = useSceneStore.getState();
    expect(furniture.map((item) => item.assetId)).toEqual(["desk.work.light.01", "chair.office.black.01"]);
    expect(furnitureGroups[0].instanceIds).toEqual(furniture.map((item) => item.id));
    expect(agentSeatAssignments.ana).toBe(furniture[1].id);
  });

  it("duplicates a selected furniture item as an independent instance", () => {
    const store = useSceneStore.getState();
    store.addFurniture("chair.office.black.01", { x: 10, y: 20 });
    const chair = useSceneStore.getState().furniture[0];
    store.rotateFurniture(chair.id);
    store.duplicateFurniture(chair.id, { x: 12, y: 22 });
    const [source, copy] = useSceneStore.getState().furniture;
    expect(copy).toMatchObject({ assetId: source.assetId, position: { x: 12, y: 22 }, orientation: "south_east" });
    expect(copy.id).not.toBe(source.id);
  });

  it("duplicates a complete furniture group with remapped surface attachments", () => {
    const store = useSceneStore.getState();
    expect(store.createWorkstationPreset("ana", { x: 10, y: 23 })).toBe(true);
    const desk = useSceneStore.getState().furniture[0];
    store.duplicateFurniture(desk.id, { x: 12, y: 25 });
    const { furniture, furnitureGroups } = useSceneStore.getState();
    expect(furniture).toHaveLength(6);
    expect(furnitureGroups).toHaveLength(2);
    const copy = furnitureGroups[1], copiedFurniture = furniture.filter((item) => item.groupId === copy.id), copiedDesk = copiedFurniture.find((item) => item.assetId === "desk.work.light.01")!;
    expect(copy).toMatchObject({ groupType: "workstation", instanceIds: copiedFurniture.map((item) => item.id) });
    expect(copiedFurniture.find((item) => item.assetId === "monitor.black.01")?.parentId).toBe(copiedDesk.id);
    expect(copiedDesk.position).toEqual({ x: 12, y: 25 });
  });

  it("groups multiple selected furniture instances into one persisted group", () => {
    const store = useSceneStore.getState();
    store.addFurniture("chair.office.black.01", { x: 10, y: 20 });
    store.addFurniture("water.dispenser.01", { x: 14, y: 20 });
    const [chair, dispenser] = useSceneStore.getState().furniture;
    store.selectFurniture(chair.id);
    store.selectFurniture(dispenser.id, true);
    store.groupSelectedFurniture();
    const { furniture, furnitureGroups, selectedFurnitureIds } = useSceneStore.getState();
    expect(selectedFurnitureIds).toEqual([chair.id, dispenser.id]);
    expect(furnitureGroups[0]).toMatchObject({ groupType: "custom", instanceIds: [chair.id, dispenser.id] });
    expect(furniture.every((item) => item.groupId === furnitureGroups[0].id)).toBe(true);
  });

  it("renames only a selected custom group and keeps it undoable", () => {
    const store = useSceneStore.getState();
    store.addFurniture("chair.office.black.01", { x: 10, y: 20 });
    store.addFurniture("water.dispenser.01", { x: 14, y: 20 });
    const [chair, dispenser] = useSceneStore.getState().furniture;
    store.selectFurniture(chair.id);
    store.selectFurniture(dispenser.id, true);
    store.groupSelectedFurniture();
    expect(store.renameSelectedFurnitureGroup("Ponto de foco")).toBe(true);
    expect(useSceneStore.getState().furnitureGroups[0]).toMatchObject({ name: "Ponto de foco", groupType: "custom", instanceIds: [chair.id, dispenser.id] });
    useSceneStore.getState().undoFurniture();
    expect(useSceneStore.getState().furnitureGroups[0].name).toBe("Grupo 1");
    expect(store.renameSelectedFurnitureGroup(" ")).toBe(false);
  });

  it("renames a workstation without changing its assigned chair", () => {
    const store = useSceneStore.getState();
    expect(store.createWorkstationPreset("ana", { x: 10, y: 23 })).toBe(true);
    const assignment = useSceneStore.getState().agentSeatAssignments.ana;
    expect(store.renameSelectedFurnitureGroup("Estação de backend")).toBe(true);
    expect(useSceneStore.getState()).toMatchObject({ furnitureGroups: [expect.objectContaining({ name: "Estação de backend", groupType: "workstation" })], agentSeatAssignments: { ana: assignment } });
  });

  it("selects every member of the active furniture group", () => {
    const store = useSceneStore.getState();
    store.addFurniture("chair.office.black.01", { x: 10, y: 20 });
    store.addFurniture("water.dispenser.01", { x: 14, y: 20 });
    const [chair, dispenser] = useSceneStore.getState().furniture;
    store.selectFurniture(chair.id);
    store.selectFurniture(dispenser.id, true);
    store.groupSelectedFurniture();
    store.selectFurniture(chair.id);
    store.selectSelectedFurnitureGroup();
    expect(useSceneStore.getState().selectedFurnitureIds).toEqual([chair.id, dispenser.id]);
    expect(useSceneStore.getState().selectedFurnitureId).toBe(chair.id);
  });

  it("ungroups selected furniture and moves the preserved multi-selection together", () => {
    const store = useSceneStore.getState();
    store.addFurniture("chair.office.black.01", { x: 10, y: 20 });
    store.addFurniture("water.dispenser.01", { x: 14, y: 20 });
    const [chair, dispenser] = useSceneStore.getState().furniture;
    store.selectFurniture(chair.id);
    store.selectFurniture(dispenser.id, true);
    store.groupSelectedFurniture();
    store.ungroupSelectedFurniture();
    expect(useSceneStore.getState().furnitureGroups).toEqual([]);
    expect(useSceneStore.getState().furniture.every((item) => !item.groupId)).toBe(true);
    expect(useSceneStore.getState().selectedFurnitureIds).toEqual([chair.id, dispenser.id]);
    store.moveFurniture(chair.id, { x: 11, y: 21 });
    expect(useSceneStore.getState().furniture.map((item) => item.position)).toEqual([{ x: 11, y: 21 }, { x: 15, y: 21 }]);
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

  it("creates a lounge with one sofa and two independent available seats", () => {
    const store = useSceneStore.getState();
    expect(store.createLoungePreset()).toBe(true);
    const { furniture, furnitureGroups } = useSceneStore.getState();
    expect(furniture.map((item) => item.assetId)).toEqual(["sofa.blue.01", "plant.floor.monstera.01"]);
    expect(furnitureGroups[0]).toMatchObject({ groupType: "lounge", instanceIds: furniture.map((item) => item.id) });
  });

  it("creates a meeting area with a table and two independent chairs", () => {
    const store = useSceneStore.getState();
    expect(store.createMeetingPreset()).toBe(true);
    const { furniture, furnitureGroups } = useSceneStore.getState();
    expect(furniture.map((item) => item.assetId)).toEqual(["desk.meeting.l.01", "chair.office.black.01", "chair.office.blue.01"]);
    expect(furnitureGroups[0]).toMatchObject({ name: "Área de reunião", groupType: "meeting", instanceIds: furniture.map((item) => item.id) });
  });

  it("creates a break area with coffee, water and a planter", () => {
    const store = useSceneStore.getState();
    expect(store.createBreakAreaPreset()).toBe(true);
    const { furniture, furnitureGroups } = useSceneStore.getState();
    expect(furniture.map((item) => item.assetId)).toEqual(["coffee.station.01", "water.dispenser.01", "plant.floor.monstera.01"]);
    expect(furnitureGroups[0]).toMatchObject({ name: "Área de pausa", groupType: "break_area", instanceIds: furniture.map((item) => item.id) });
  });

  it("creates a sector partition with glass and planter dividers", () => {
    const store = useSceneStore.getState();
    expect(store.createPartitionPreset()).toBe(true);
    const { furniture, furnitureGroups } = useSceneStore.getState();
    expect(furniture.map((item) => item.assetId)).toEqual(["divider.glass.01", "divider.planter.01"]);
    expect(furnitureGroups[0]).toMatchObject({ name: "Divisória setorial", groupType: "partition", instanceIds: furniture.map((item) => item.id) });
  });
});
