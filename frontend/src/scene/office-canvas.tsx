import { useEffect, useMemo, useRef } from "react";
import Phaser from "phaser";
import { OfficeScene } from "./office-scene";
import { publishSceneAgents } from "./scene-events";
import { useSceneStore } from "../stores/scene-store";
import { highlightedFurnitureIds as groupHighlightIds } from "./furniture/catalog";

export function OfficeCanvas() {
  const parent = useRef<HTMLDivElement>(null);
  const agents = useSceneStore((state) => state.agents);
  const editMode = useSceneStore((state) => state.editMode);
  const furniture = useSceneStore((state) => state.furniture);
  const furnitureGroups = useSceneStore((state) => state.furnitureGroups);
  const agentSeatAssignments = useSceneStore((state) => state.agentSeatAssignments);
  const selectedFurnitureId = useSceneStore((state) => state.selectedFurnitureId);
  const selectedFurnitureIds = useSceneStore((state) => state.selectedFurnitureIds);
  const placingFurnitureAssetId = useSceneStore((state) => state.placingFurnitureAssetId);
  const placingFurnitureOrientation = useSceneStore((state) => state.placingFurnitureOrientation);
  const highlightedFurnitureIds = useMemo(() => groupHighlightIds(furniture, furnitureGroups, selectedFurnitureId, selectedFurnitureIds), [furniture, furnitureGroups, selectedFurnitureId, selectedFurnitureIds]);
  useEffect(() => {
    if (!parent.current) return;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current, width: "100%", height: "100%", backgroundColor: "#17222b", scene: OfficeScene, scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH } });
    return () => game.destroy(true);
  }, []);
  useEffect(() => publishSceneAgents(agents, editMode, furniture, agentSeatAssignments, selectedFurnitureIds, highlightedFurnitureIds, placingFurnitureAssetId, placingFurnitureOrientation), [agents, editMode, furniture, agentSeatAssignments, selectedFurnitureIds, highlightedFurnitureIds, placingFurnitureAssetId, placingFurnitureOrientation]);
  return <div ref={parent} className="office-canvas" aria-label="Escritório isométrico" />;
}
