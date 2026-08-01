import { create } from "zustand";
import type { Agent } from "../types";
import { defaultFurnitureOrientation, furnitureAsset, furnitureCells, furnitureOrientations, type AgentSeatAssignments, type FurnitureGroup, type FurnitureInstance, type FurnitureOrientation } from "../scene/furniture/catalog";
import { isInsideEmptyRoomFloor } from "../scene/maps/office-layout";

type LayoutSnapshot = { furniture: FurnitureInstance[]; furnitureGroups: FurnitureGroup[]; agentSeatAssignments: AgentSeatAssignments };
const snapshot = (state: LayoutSnapshot): LayoutSnapshot => ({ furniture: state.furniture, furnitureGroups: state.furnitureGroups, agentSeatAssignments: state.agentSeatAssignments });

const initialAgents: Agent[] = [
  { id: "ana", name: "Ana", role: "Engenharia", description: "Implementa e revisa serviços.", color: 0x5ca6d8, status: "working", direction: "north", position: { x: 10, y: 23 }, basePosition: { x: 10, y: 23 }, skills: ["fastapi"], skillStates: [{ id: "fastapi", enabled: true }], pluginStates: [], task: "Validando adapter Codex" },
  { id: "bruno", name: "Bruno", role: "Qualidade", description: "Cria testes e avalia mudanças.", color: 0xd18b64, status: "seated", direction: "west", position: { x: 10, y: 14 }, basePosition: { x: 10, y: 14 }, skills: ["testing"], skillStates: [{ id: "testing", enabled: true }], pluginStates: [] },
];

function movingIds(furniture: FurnitureInstance[], id: string) {
  const pivot = furniture.find((item) => item.id === id); if (!pivot) return new Set<string>();
  const ids = new Set(furniture.filter((item) => item.id === id || (pivot.groupId && item.groupId === pivot.groupId)).map((item) => item.id));
  furniture.filter((item) => item.parentId && ids.has(item.parentId)).forEach((item) => ids.add(item.id));
  return ids;
}

function removalIds(furniture: FurnitureInstance[], id: string) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    furniture.filter((item) => item.parentId && ids.has(item.parentId) && !ids.has(item.id)).forEach((item) => { ids.add(item.id); changed = true; });
  }
  return ids;
}

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
  furnitureGroups: FurnitureGroup[];
  agentSeatAssignments: AgentSeatAssignments;
  selectedFurnitureId?: string;
  placingFurnitureAssetId?: string;
  placingFurnitureOrientation?: FurnitureOrientation;
  addFurniture: (assetId: string, position: FurnitureInstance["position"]) => void;
  startFurniturePlacement: (assetId: string) => void;
  placeFurniture: (position: FurnitureInstance["position"]) => boolean;
  rotateFurniturePlacement: () => void;
  cancelFurniturePlacement: () => void;
  addSurfaceFurniture: (assetId: string, hostId?: string) => boolean;
  moveFurniture: (id: string, position: FurnitureInstance["position"]) => void;
  removeFurniture: (id: string) => void;
  rotateFurniture: (id: string) => void;
  selectFurniture: (id?: string) => void;
  replaceOfficeLayout: (items: FurnitureInstance[], groups: FurnitureGroup[], assignments: AgentSeatAssignments) => void;
  assignAgentSeat: (agentId: string, seatInstanceId?: string) => void;
  createWorkstationPreset: (agentId: string, position: FurnitureInstance["position"]) => boolean;
  createLoungePreset: () => boolean;
  clearFurniture: () => void;
  undoFurniture: () => void;
  redoFurniture: () => void;
  furniturePast: LayoutSnapshot[];
  furnitureFuture: LayoutSnapshot[];
};

export const useSceneStore = create<SceneStore>((set) => ({
  agents: initialAgents,
  selectedId: "ana",
  editMode: false,
  select: (selectedId) => set({ selectedId }),
  toggleEdit: () => set((state) => ({ editMode: !state.editMode, placingFurnitureAssetId: state.editMode ? undefined : state.placingFurnitureAssetId, placingFurnitureOrientation: state.editMode ? undefined : state.placingFurnitureOrientation })),
  addAgent: (name, role) => set((state) => {
    if (state.agents.length >= 8) return state;
    const index = state.agents.length;
    const id = crypto.randomUUID();
    const positions = [{ x: 4, y: 23 }, { x: 10, y: 23 }, { x: 3, y: 11 }, { x: 6, y: 13 }, { x: 10, y: 14 }, { x: 10, y: 12 }, { x: 9, y: 8 }, { x: 20, y: 10 }]; const position = positions[index];
    return { agents: [...state.agents, { id, name, role, description: "Novo agente do workspace.", color: [0x85ba82, 0xa786d4, 0xe0ae59][index % 3], status: "idle", direction: "north", position, basePosition: position, skills: [], skillStates: [], pluginStates: [] }], selectedId: id };
  }),
  removeSelected: () => set((state) => {
    const assignments = { ...state.agentSeatAssignments }; if (state.selectedId) delete assignments[state.selectedId];
    return { agents: state.agents.filter((agent) => agent.id !== state.selectedId), selectedId: undefined, agentSeatAssignments: assignments };
  }),
  assignSkill: (agentId, skillId) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId && !agent.skills.includes(skillId) ? { ...agent, skills: [...agent.skills, skillId], skillStates: [...agent.skillStates, { id: skillId, enabled: true }] } : agent) })),
  setTask: (agentId, task) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId ? { ...agent, task, status: "working" } : agent) })),
  moveAgent: (agentId, x, y) => set((state) => ({ agents: state.agents.map((agent) => agent.id === agentId ? { ...agent, position: { x, y }, basePosition: { x, y } } : agent) })),
  replaceAgents: (agents) => set((state) => ({ agents, selectedId: agents.some((agent) => agent.id === state.selectedId) ? state.selectedId : agents[0]?.id })),
  furniture: [], furnitureGroups: [], agentSeatAssignments: {}, furniturePast: [], furnitureFuture: [],
  addFurniture: (assetId, position) => set((state) => ({ furniture: [...state.furniture, { id: crypto.randomUUID(), assetId, position, orientation: defaultFurnitureOrientation(assetId), createdAt: new Date().toISOString() }], furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] })),
  startFurniturePlacement: (assetId) => set({ placingFurnitureAssetId: assetId, placingFurnitureOrientation: defaultFurnitureOrientation(assetId), selectedFurnitureId: undefined }),
  placeFurniture: (position) => {
    let placed = false;
    set((state) => {
      const asset = state.placingFurnitureAssetId && furnitureAsset(state.placingFurnitureAssetId);
      if (!asset) return state;
      const cells = asset.footprint.map((offset) => ({ x: position.x + offset.x, y: position.y + offset.y }));
      const occupied = furnitureCells(state.furniture);
      if (!cells.every(isInsideEmptyRoomFloor) || cells.some((cell) => occupied.has(`${cell.x},${cell.y}`))) return state;
      placed = true;
      return { furniture: [...state.furniture, { id: crypto.randomUUID(), assetId: asset.id, position, orientation: state.placingFurnitureOrientation ?? defaultFurnitureOrientation(asset.id), createdAt: new Date().toISOString() }], placingFurnitureAssetId: undefined, placingFurnitureOrientation: undefined, furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] };
    });
    return placed;
  },
  rotateFurniturePlacement: () => set((state) => {
    const asset = state.placingFurnitureAssetId && furnitureAsset(state.placingFurnitureAssetId);
    if (!asset) return state;
    const orientations = furnitureOrientations(asset); if (orientations.length < 2) return state;
    const current = state.placingFurnitureOrientation ?? orientations[0];
    return { placingFurnitureOrientation: orientations[(orientations.indexOf(current) + 1) % orientations.length] };
  }),
  cancelFurniturePlacement: () => set({ placingFurnitureAssetId: undefined, placingFurnitureOrientation: undefined }),
  addSurfaceFurniture: (assetId, hostId) => {
    let added = false;
    set((state) => {
      const asset = furnitureAsset(assetId), host = state.furniture.find((item) => item.id === hostId), hostAsset = host && furnitureAsset(host.assetId);
      if (!asset?.surface || !host || !hostAsset || !asset.surface.hostCategories.includes(hostAsset.category)) return state;
      added = true;
      return { furniture: [...state.furniture, { id: crypto.randomUUID(), assetId, position: { ...host.position }, orientation: "north_east", createdAt: new Date().toISOString(), parentId: host.id, surfaceOffset: asset.surface.offset }], furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] };
    });
    return added;
  },
  moveFurniture: (id, position) => set((state) => {
    const pivot = state.furniture.find((item) => item.id === id); if (!pivot) return state;
    const delta = { x: position.x - pivot.position.x, y: position.y - pivot.position.y };
    const ids = movingIds(state.furniture, id);
    return { furniture: state.furniture.map((item) => ids.has(item.id) ? { ...item, position: { x: item.position.x + delta.x, y: item.position.y + delta.y } } : item), furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] };
  }),
  removeFurniture: (id) => set((state) => {
    const ids = removalIds(state.furniture, id);
    const agentSeatAssignments = Object.fromEntries(Object.entries(state.agentSeatAssignments).filter(([, seatId]) => !ids.has(seatId)));
    return { furniture: state.furniture.filter((item) => !ids.has(item.id)), furnitureGroups: state.furnitureGroups.map((group) => ({ ...group, instanceIds: group.instanceIds.filter((itemId) => !ids.has(itemId)) })).filter((group) => group.instanceIds.length), agentSeatAssignments, selectedFurnitureId: state.selectedFurnitureId && ids.has(state.selectedFurnitureId) ? undefined : state.selectedFurnitureId, furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] };
  }),
  rotateFurniture: (id) => set((state) => {
    const item = state.furniture.find((value) => value.id === id), asset = item && furnitureAsset(item.assetId);
    if (!item || !asset) return state;
    const orientations = furnitureOrientations(asset); if (orientations.length < 2) return state;
    const next = orientations[(orientations.indexOf(item.orientation) + 1) % orientations.length];
    return { furniture: state.furniture.map((value) => value.id === id ? { ...value, orientation: next } : value), furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] };
  }),
  selectFurniture: (selectedFurnitureId) => set({ selectedFurnitureId }),
  replaceOfficeLayout: (furniture, furnitureGroups, agentSeatAssignments) => set({ furniture, furnitureGroups, agentSeatAssignments, selectedFurnitureId: undefined, furniturePast: [], furnitureFuture: [] }),
  assignAgentSeat: (agentId, seatInstanceId) => set((state) => {
    const agentSeatAssignments = { ...state.agentSeatAssignments };
    if (seatInstanceId) agentSeatAssignments[agentId] = seatInstanceId; else delete agentSeatAssignments[agentId];
    return { agentSeatAssignments, furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] };
  }),
  createWorkstationPreset: (agentId, position) => {
    let created = false;
    set((state) => {
      const groupId = crypto.randomUUID(), deskId = crypto.randomUUID(), chairId = crypto.randomUUID(), monitorId = crypto.randomUUID(), now = new Date().toISOString();
      const additions: FurnitureInstance[] = [
        { id: deskId, assetId: "desk.work.light.01", position: { x: position.x, y: position.y - 2 }, orientation: defaultFurnitureOrientation("desk.work.light.01"), createdAt: now, groupId },
        { id: chairId, assetId: "chair.office.black.01", position, orientation: "north_east", createdAt: now, groupId },
        { id: monitorId, assetId: "monitor.black.01", position: { x: position.x, y: position.y - 2 }, orientation: "north_east", createdAt: now, groupId, parentId: deskId, surfaceOffset: furnitureAsset("monitor.black.01")!.surface!.offset },
      ];
      const occupied = furnitureCells(state.furniture);
      for (const item of additions) for (const offset of furnitureAsset(item.assetId)!.footprint) {
        const cell = { x: item.position.x + offset.x, y: item.position.y + offset.y };
        if (!isInsideEmptyRoomFloor(cell) || occupied.has(`${cell.x},${cell.y}`)) return state;
        occupied.set(`${cell.x},${cell.y}`, item.id);
      }
      created = true;
      return { furniture: [...state.furniture, ...additions], furnitureGroups: [...state.furnitureGroups, { id: groupId, name: `Estação ${agentId}`, instanceIds: additions.map((item) => item.id), groupType: "workstation" }], agentSeatAssignments: { ...state.agentSeatAssignments, [agentId]: chairId }, selectedFurnitureId: deskId, furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] };
    });
    return created;
  },
  createLoungePreset: () => {
    let created = false;
    set((state) => {
      const occupied = furnitureCells(state.furniture);
      for (const position of [{ x: 8, y: 32 }, { x: 14, y: 30 }, { x: 5, y: 34 }]) {
        const groupId = crypto.randomUUID(), sofaId = crypto.randomUUID(), plantId = crypto.randomUUID(), now = new Date().toISOString();
        const additions: FurnitureInstance[] = [
          { id: sofaId, assetId: "sofa.blue.01", position, orientation: "north_east", createdAt: now, groupId },
          { id: plantId, assetId: "plant.floor.monstera.01", position: { x: position.x + 2, y: position.y }, orientation: "north_east", createdAt: now, groupId },
        ];
        const cells = additions.flatMap((item) => furnitureAsset(item.assetId)!.footprint.map((offset) => ({ x: item.position.x + offset.x, y: item.position.y + offset.y })));
        if (!cells.every(isInsideEmptyRoomFloor) || cells.some((cell) => occupied.has(`${cell.x},${cell.y}`))) continue;
        created = true;
        return { furniture: [...state.furniture, ...additions], furnitureGroups: [...state.furnitureGroups, { id: groupId, name: "Lounge", instanceIds: additions.map((item) => item.id), groupType: "lounge" }], selectedFurnitureId: sofaId, furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] };
      }
      return state;
    });
    return created;
  },
  clearFurniture: () => set((state) => ({ furniture: [], furnitureGroups: [], agentSeatAssignments: {}, selectedFurnitureId: undefined, furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: [] })),
  undoFurniture: () => set((state) => { const previous = state.furniturePast.at(-1); return previous ? { ...previous, furniturePast: state.furniturePast.slice(0, -1), furnitureFuture: [snapshot(state), ...state.furnitureFuture] } : state; }),
  redoFurniture: () => set((state) => { const next = state.furnitureFuture[0]; return next ? { ...next, furniturePast: [...state.furniturePast, snapshot(state)], furnitureFuture: state.furnitureFuture.slice(1) } : state; }),
}));
