import { create } from "zustand";
import type { Agent } from "../types";
import type { FurnitureInstance } from "../scene/furniture/catalog";

const initialAgents: Agent[] = [
  { id: "ana", name: "Ana", role: "Engenharia", description: "Implementa e revisa serviços.", color: 0x5ca6d8, status: "working", direction: "north", position: { x: 10, y: 23 }, basePosition: { x: 10, y: 23 }, skills: ["fastapi"], skillStates: [{ id: "fastapi", enabled: true }], pluginStates: [], task: "Validando adapter Codex" },
  { id: "bruno", name: "Bruno", role: "Qualidade", description: "Cria testes e avalia mudanças.", color: 0xd18b64, status: "seated", direction: "west", position: { x: 10, y: 14 }, basePosition: { x: 10, y: 14 }, skills: ["testing"], skillStates: [{ id: "testing", enabled: true }], pluginStates: [] },
];

type SceneStore = {
  agents: Agent[];
  selectedId?: string;
  editMode: boolean;
  select: (id?: string) => void;
  toggleEdit: () => void;
  addAgent: (name: string, role: string) => void;
  removeSelected: () => void;
  assignSkill: (agentId: string, skillId: string) => void;
  setTask: (agentId: string, task: string) => void;
  moveAgent: (agentId: string, x: number, y: number) => void;
  replaceAgents: (agents: Agent[]) => void;
  furniture: FurnitureInstance[];
  selectedFurnitureId?: string;
  addFurniture: (assetId: string, position: FurnitureInstance["position"]) => void;
  moveFurniture: (id: string, position: FurnitureInstance["position"]) => void;
  removeFurniture: (id: string) => void;
  rotateFurniture: (id: string) => void;
  selectFurniture: (id?: string) => void;
  replaceFurniture: (items: FurnitureInstance[]) => void;
  clearFurniture: () => void;
  undoFurniture: () => void;
  redoFurniture: () => void;
  furniturePast: FurnitureInstance[][];
  furnitureFuture: FurnitureInstance[][];
};

export const useSceneStore = create<SceneStore>((set) => ({
  agents: initialAgents,
  selectedId: "ana",
  editMode: false,
  select: (selectedId) => set({ selectedId }),
  toggleEdit: () => set((state) => ({ editMode: !state.editMode })),
  addAgent: (name, role) => set((state) => {
    if (state.agents.length >= 8) return state;
    const index = state.agents.length;
    const id = crypto.randomUUID();
    const positions = [{ x: 4, y: 23 }, { x: 10, y: 23 }, { x: 3, y: 11 }, { x: 6, y: 13 }, { x: 10, y: 14 }, { x: 10, y: 12 }, { x: 9, y: 8 }, { x: 20, y: 10 }]; const position = positions[index];
    return { agents: [...state.agents, { id, name, role, description: "Novo agente do workspace.", color: [0x85ba82, 0xa786d4, 0xe0ae59][index % 3], status: "idle", direction: "north", position, basePosition: position, skills: [], skillStates: [], pluginStates: [] }], selectedId: id };
  }),
  removeSelected: () => set((state) => ({ agents: state.agents.filter((agent) => agent.id !== state.selectedId), selectedId: undefined })),
  assignSkill: (agentId, skillId) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId && !agent.skills.includes(skillId) ? { ...agent, skills: [...agent.skills, skillId], skillStates: [...agent.skillStates, { id: skillId, enabled: true }] } : agent) })),
  setTask: (agentId, task) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId ? { ...agent, task, status: "working" } : agent) })),
  moveAgent: (agentId, x, y) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId ? { ...agent, position: { x, y }, basePosition: { x, y } } : agent) })),
  replaceAgents: (agents) => set((state) => ({ agents, selectedId: agents.some((agent) => agent.id === state.selectedId) ? state.selectedId : agents[0]?.id })),
  furniture: [], furniturePast: [], furnitureFuture: [],
  addFurniture: (assetId, position) => set((state) => ({ furniture: [...state.furniture, { id: crypto.randomUUID(), assetId, position, orientation: "north_east", createdAt: new Date().toISOString() }], furniturePast: [...state.furniturePast, state.furniture], furnitureFuture: [] })),
  moveFurniture: (id, position) => set((state) => ({ furniture: state.furniture.map((item) => item.id === id ? { ...item, position } : item), furniturePast: [...state.furniturePast, state.furniture], furnitureFuture: [] })),
  removeFurniture: (id) => set((state) => ({ furniture: state.furniture.filter((item) => item.id !== id), selectedFurnitureId: state.selectedFurnitureId === id ? undefined : state.selectedFurnitureId, furniturePast: [...state.furniturePast, state.furniture], furnitureFuture: [] })),
  rotateFurniture: (id) => set((state) => ({ furniture: state.furniture.map((item) => item.id !== id ? item : { ...item, orientation: ({ north_east: "north_west", north_west: "south_west", south_west: "south_east", south_east: "north_east" } as const)[item.orientation] }), furniturePast: [...state.furniturePast, state.furniture], furnitureFuture: [] })),
  selectFurniture: (selectedFurnitureId) => set({ selectedFurnitureId }),
  replaceFurniture: (furniture) => set({ furniture, selectedFurnitureId: undefined, furniturePast: [], furnitureFuture: [] }),
  clearFurniture: () => set((state) => ({ furniture: [], selectedFurnitureId: undefined, furniturePast: [...state.furniturePast, state.furniture], furnitureFuture: [] })),
  undoFurniture: () => set((state) => { const previous = state.furniturePast.at(-1); return previous ? { furniture: previous, furniturePast: state.furniturePast.slice(0, -1), furnitureFuture: [state.furniture, ...state.furnitureFuture] } : state; }),
  redoFurniture: () => set((state) => { const next = state.furnitureFuture[0]; return next ? { furniture: next, furniturePast: [...state.furniturePast, state.furniture], furnitureFuture: state.furnitureFuture.slice(1) } : state; }),
}));
