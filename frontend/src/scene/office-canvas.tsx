import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { OfficeScene } from "./office-scene";
import { publishSceneAgents } from "./scene-events";
import { useSceneStore } from "../stores/scene-store";

export function OfficeCanvas() {
  const parent = useRef<HTMLDivElement>(null);
  const agents = useSceneStore((state) => state.agents);
  const editMode = useSceneStore((state) => state.editMode);
  const furniture = useSceneStore((state) => state.furniture);
  const agentSeatAssignments = useSceneStore((state) => state.agentSeatAssignments);
  useEffect(() => {
    if (!parent.current) return;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current, width: "100%", height: "100%", backgroundColor: "#17222b", scene: OfficeScene, scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH } });
    return () => game.destroy(true);
  }, []);
  useEffect(() => publishSceneAgents(agents, editMode, furniture, agentSeatAssignments), [agents, editMode, furniture, agentSeatAssignments]);
  return <div ref={parent} className="office-canvas" aria-label="Escritório isométrico" />;
}
