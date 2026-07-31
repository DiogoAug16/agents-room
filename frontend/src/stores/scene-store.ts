import { create } from "zustand";
import type { Agent, Skill } from "../types";

const initialAgents: Agent[] = [
  { id: "ana", name: "Ana", role: "Engenharia", description: "Implementa e revisa serviços.", color: 0x5ca6d8, status: "working", direction: "south", position: { x: 8, y: 6 }, basePosition: { x: 8, y: 6 }, skills: ["fastapi"], skillStates: [{ id: "fastapi", enabled: true }], pluginStates: [], task: "Validando adapter Codex" },
  { id: "bruno", name: "Bruno", role: "Qualidade", description: "Cria testes e avalia mudanças.", color: 0xd18b64, status: "seated", direction: "south", position: { x: 14, y: 8 }, basePosition: { x: 14, y: 8 }, skills: ["testing"], skillStates: [{ id: "testing", enabled: true }], pluginStates: [] },
];

export const skills: Skill[] = [
  { id: "fastapi", name: "FastAPI", description: "APIs locais tipadas", category: "Backend" },
  { id: "testing", name: "Testes", description: "Testes e regressões", category: "Qualidade" },
  { id: "ui", name: "Interface", description: "Fluxos React e acessibilidade", category: "Frontend" },
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
    return { agents: [...state.agents, { id, name, role, description: "Novo agente do workspace.", color: [0x85ba82, 0xa786d4, 0xe0ae59][index % 3], status: "idle", direction: "south", position: { x: 5 + index * 2, y: 10 }, basePosition: { x: 5 + index * 2, y: 10 }, skills: [], skillStates: [], pluginStates: [] }], selectedId: id };
  }),
  removeSelected: () => set((state) => ({ agents: state.agents.filter((agent) => agent.id !== state.selectedId), selectedId: undefined })),
  assignSkill: (agentId, skillId) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId && !agent.skills.includes(skillId) ? { ...agent, skills: [...agent.skills, skillId], skillStates: [...agent.skillStates, { id: skillId, enabled: true }] } : agent) })),
  setTask: (agentId, task) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId ? { ...agent, task, status: "working" } : agent) })),
  moveAgent: (agentId, x, y) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId ? { ...agent, position: { x, y }, basePosition: { x, y } } : agent) })),
  replaceAgents: (agents) => set((state) => ({ agents, selectedId: agents.some((agent) => agent.id === state.selectedId) ? state.selectedId : agents[0]?.id })),
}));
