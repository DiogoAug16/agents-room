import type { Agent, Skill, VisualStatus } from "../types";

const baseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";
const colors = [0x5ca6d8, 0xd18b64, 0x85ba82, 0xa786d4, 0xe0ae59];

type ApiAgent = { id: string; name: string; role: string; description: string; visualStatus: VisualStatus; position: { x: number; y: number }; basePosition: { x: number; y: number }; direction: Agent["direction"]; skills: { id: string }[] };
export type Workspace = { id: string; name: string; room: { width: number; height: number }; projectRoot: string };
export type Plugin = { id: string; name: string; description: string; manifest: { permissions?: string[] } };
export type Approval = { id: string; taskId: string; kind: string; summary: string };
export type Task = { id: string; prompt: string; state: string; accessMode: string; result?: string; createdAt: string; finishedAt?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, ...init });
  if (!response.ok) throw new Error(await response.text());
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; codexAvailable: boolean }>("/health"),
  workspace: () => request<Workspace>("/workspaces/default"),
  agents: async (workspaceId: string): Promise<Agent[]> => (await request<ApiAgent[]>(`/workspaces/${workspaceId}/agents`)).map((agent, index) => ({ ...agent, status: agent.visualStatus, color: colors[index % colors.length], skills: agent.skills.map((skill) => skill.id) })),
  skills: () => request<Skill[]>("/skills"),
  plugins: () => request<Plugin[]>("/plugins"),
  createAgent: (workspaceId: string, input: { name: string; role: string }) => request<Agent>(`/workspaces/${workspaceId}/agents`, { method: "POST", body: JSON.stringify(input) }),
  deleteAgent: (agentId: string) => request<void>(`/agents/${agentId}`, { method: "DELETE" }),
  moveAgent: (agentId: string, x: number, y: number) => request(`/agents/${agentId}/position`, { method: "PATCH", body: JSON.stringify({ x, y }) }),
  assignSkill: (agentId: string, skillId: string) => request(`/agents/${agentId}/skills`, { method: "POST", body: JSON.stringify({ skill_id: skillId }) }),
  assignPlugin: (agentId: string, pluginId: string) => request(`/agents/${agentId}/plugins`, { method: "POST", body: JSON.stringify({ plugin_id: pluginId }) }),
  createTask: (agentId: string, prompt: string, accessMode = "read_only") => request<{ id: string; state: string }>(`/agents/${agentId}/tasks`, { method: "POST", body: JSON.stringify({ prompt, access_mode: accessMode }) }),
  tasks: (agentId: string) => request<Task[]>(`/agents/${agentId}/tasks`),
  cancelTask: (taskId: string) => request<{ id: string; state: string }>(`/tasks/${taskId}/cancel`, { method: "POST" }),
  approvals: (workspaceId: string) => request<Approval[]>(`/workspaces/${workspaceId}/approvals`),
  decideApproval: (approvalId: string, approved: boolean) => request(`/approvals/${approvalId}/decision`, { method: "POST", body: JSON.stringify({ approved }) }),
  createInteraction: (agentId: string, targetAgentId: string, summary: string) => request<{ id: string; state: string }>(`/agents/${agentId}/interactions`, { method: "POST", body: JSON.stringify({ target_agent_id: targetAgentId, summary, kind: "context_share" }) }),
  startInteraction: (interactionId: string) => request(`/interactions/${interactionId}/started`, { method: "POST" }),
  completeInteraction: (interactionId: string) => request(`/interactions/${interactionId}/completed`, { method: "POST" }),
  failInteraction: (interactionId: string) => request(`/interactions/${interactionId}/failed`, { method: "POST" }),
};

export function websocketUrl(workspaceId: string) {
  return `${baseUrl.replace("http", "ws")}/ws/workspaces/${workspaceId}`;
}
