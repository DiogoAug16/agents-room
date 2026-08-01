import type { Agent } from "../types";
import type { AgentSeatAssignments, FurnitureInstance } from "./furniture/catalog";

export const sceneEvents = new EventTarget();
export function publishSceneAgents(agents: Agent[], editMode: boolean, furniture: FurnitureInstance[], agentSeatAssignments: AgentSeatAssignments) {
  sceneEvents.dispatchEvent(new CustomEvent("agents", { detail: { agents, editMode, furniture, agentSeatAssignments } }));
}

export type SceneInteraction = { interactionId: string; sourceAgentId: string; targetAgentId: string; summary: string };
export function publishSceneInteraction(interaction: SceneInteraction) {
  sceneEvents.dispatchEvent(new CustomEvent("interaction", { detail: interaction }));
}
