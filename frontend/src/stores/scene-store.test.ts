import { beforeEach, describe, expect, it } from "vitest";
import { useSceneStore } from "./scene-store";

describe("furniture editor history", () => {
  beforeEach(() => useSceneStore.getState().replaceOfficeLayout([], {}));

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
});
