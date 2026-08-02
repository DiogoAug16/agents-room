import type { Agent } from "../types";
import type { AgentSeatAssignments, FurnitureGroup, FurnitureInstance, FurnitureOrientation } from "./furniture/catalog";

export const sceneEvents = new EventTarget();
export function publishSceneAgents(agents: Agent[], editMode: boolean, furniture: FurnitureInstance[], furnitureGroups: FurnitureGroup[], agentSeatAssignments: AgentSeatAssignments, selectedFurnitureIds: string[], highlightedFurnitureIds = selectedFurnitureIds, placingFurnitureAssetId?: string, placingFurnitureOrientation?: FurnitureOrientation) {
  sceneEvents.dispatchEvent(new CustomEvent("agents", { detail: { agents, editMode, furniture, furnitureGroups, agentSeatAssignments, selectedFurnitureIds, highlightedFurnitureIds, placingFurnitureAssetId, placingFurnitureOrientation } }));
}

export type SceneInteraction = { interactionId: string; sourceAgentId: string; targetAgentId: string; summary: string };
export function publishSceneInteraction(interaction: SceneInteraction) {
  sceneEvents.dispatchEvent(new CustomEvent("interaction", { detail: interaction }));
}
