import { beforeEach, describe, expect, it } from "vitest";
import { useSceneStore } from "./scene-store";

describe("furniture editor history", () => {
  beforeEach(() => useSceneStore.getState().replaceFurniture([]));

  it("undoes and redoes a furniture insertion", () => {
    const store = useSceneStore.getState();
    store.addFurniture("chair.office.black.01", { x: 10, y: 20 });
    expect(useSceneStore.getState().furniture).toHaveLength(1);
    useSceneStore.getState().undoFurniture();
    expect(useSceneStore.getState().furniture).toEqual([]);
    useSceneStore.getState().redoFurniture();
    expect(useSceneStore.getState().furniture).toHaveLength(1);
  });
});
