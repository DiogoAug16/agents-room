import * as Dialog from "@radix-ui/react-dialog";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, websocketUrl } from "./api/client";
import { OfficeCanvas } from "./scene/office-canvas";
import { publishSceneInteraction } from "./scene/scene-events";
import { skills, useSceneStore } from "./stores/scene-store";

const agentSchema = z.object({ name: z.string().trim().min(2, "Informe ao menos 2 caracteres"), role: z.string().trim().min(2, "Informe uma função") });
type AgentForm = z.infer<typeof agentSchema>;

function DraggableSkill({ skillId, label }: { skillId: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: skillId });
  return <button ref={setNodeRef} className="skill-card" style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.45 : 1 }} {...listeners} {...attributes}><span>{label}</span><small>{skills.find((skill) => skill.id === skillId)?.description}</small></button>;
}

function SkillDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "selected-agent" });
  return <div ref={setNodeRef} className={isOver ? "skill-list is-over" : "skill-list"}>{children}</div>;
}

function SceneDrop({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "scene" });
  return <div className="scene-drop" ref={setNodeRef}>{children}</div>;
}

function AddAgentDialog({ onCreate }: { onCreate: (form: AgentForm) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<AgentForm>({ defaultValues: { name: "", role: "" } });
  const submit = async (form: AgentForm) => {
    const parsed = agentSchema.safeParse(form);
    if (!parsed.success) { parsed.error.issues.forEach((issue) => setError(issue.path[0] as keyof AgentForm, { message: issue.message })); return; }
    await onCreate(parsed.data); reset(); setOpen(false);
  };
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger className="primary">+ Agente</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog"><Dialog.Title>Novo agente</Dialog.Title><Dialog.Description>Cria a estação e seleciona o novo agente.</Dialog.Description><form onSubmit={handleSubmit(submit)}><label>Nome<input {...register("name")} autoFocus /></label>{errors.name && <p className="form-error">{errors.name.message}</p>}<label>Função<input {...register("role")} /></label>{errors.role && <p className="form-error">{errors.role.message}</p>}<div className="dialog-actions"><Dialog.Close className="button">Cancelar</Dialog.Close><button className="primary" disabled={isSubmitting} type="submit">Criar</button></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function App() {
  const agents = useSceneStore((state) => state.agents);
  const selectedId = useSceneStore((state) => state.selectedId);
  const editMode = useSceneStore((state) => state.editMode);
  const select = useSceneStore((state) => state.select);
  const toggleEdit = useSceneStore((state) => state.toggleEdit);
  const assignSkill = useSceneStore((state) => state.assignSkill);
  const setTask = useSceneStore((state) => state.setTask);
  const moveAgent = useSceneStore((state) => state.moveAgent);
  const removeSelected = useSceneStore((state) => state.removeSelected);
  const replaceAgents = useSceneStore((state) => state.replaceAgents);
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({ queryKey: ["workspace"], queryFn: api.workspace, retry: false });
  const agentsQuery = useQuery({ queryKey: ["agents", workspaceQuery.data?.id], queryFn: () => api.agents(workspaceQuery.data!.id), enabled: Boolean(workspaceQuery.data), retry: false });
  const pluginsQuery = useQuery({ queryKey: ["plugins"], queryFn: api.plugins, retry: false });
  const approvalsQuery = useQuery({ queryKey: ["approvals", workspaceQuery.data?.id], queryFn: () => api.approvals(workspaceQuery.data!.id), enabled: Boolean(workspaceQuery.data), retry: false });
  const [task, setTaskDraft] = useState("");
  const [taskAccess, setTaskAccess] = useState("read_only");
  const [interactionTarget, setInteractionTarget] = useState("");
  const [interactionSummary, setInteractionSummary] = useState("Solicitando revisão da tarefa atual.");
  const [events, setEvents] = useState<string[]>(["POC Codex validada: sessão local disponível."]);
  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId), [agents, selectedId]);
  const tasksQuery = useQuery({ queryKey: ["tasks", selectedId], queryFn: () => api.tasks(selectedId!), enabled: Boolean(selectedId), retry: false });
  const invalidateAgents = () => workspaceQuery.data && queryClient.invalidateQueries({ queryKey: ["agents", workspaceQuery.data.id] });
  const invalidateTasks = () => { if (selectedId) return queryClient.invalidateQueries({ queryKey: ["tasks", selectedId] }); };

  useEffect(() => { if (agentsQuery.data) replaceAgents(agentsQuery.data); }, [agentsQuery.data, replaceAgents]);
  useEffect(() => {
    if (!workspaceQuery.data) return;
    const socket = new WebSocket(websocketUrl(workspaceQuery.data.id));
    socket.onmessage = ({ data }) => {
      const event = JSON.parse(data) as { type: string; sourceAgentId?: string; targetAgentId?: string; payload: { interactionId?: string; summary?: string } };
      setEvents((items) => [event.payload.summary ?? event.type, ...items].slice(0, 10));
      if (event.type.startsWith("agent.") || event.type.startsWith("skill.") || event.type.startsWith("plugin.") || event.type.startsWith("task.")) void invalidateAgents();
      if (event.type.startsWith("task.")) void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (event.type.startsWith("approval.") || event.type === "task.approval.requested") void queryClient.invalidateQueries({ queryKey: ["approvals", workspaceQuery.data!.id] });
      if (event.type === "agent.interaction.requested" && event.sourceAgentId && event.targetAgentId && event.payload.interactionId && event.payload.summary) publishSceneInteraction({ interactionId: event.payload.interactionId, sourceAgentId: event.sourceAgentId, targetAgentId: event.targetAgentId, summary: event.payload.summary });
    };
    return () => socket.close();
  }, [workspaceQuery.data, queryClient]);
  useEffect(() => {
    const onSelect = (event: Event) => select((event as CustomEvent<string>).detail);
    const onMove = (event: Event) => { const { id, x, y } = (event as CustomEvent<{ id: string; x: number; y: number }>).detail; moveAgent(id, x, y); void api.moveAgent(id, x, y).then(invalidateAgents); setEvents((items) => [`Estação movida para (${x}, ${y}).`, ...items].slice(0, 10)); };
    const onDeselect = () => select(undefined);
    window.addEventListener("agent:select", onSelect); window.addEventListener("agent:move", onMove); window.addEventListener("agent:deselect", onDeselect);
    return () => { window.removeEventListener("agent:select", onSelect); window.removeEventListener("agent:move", onMove); window.removeEventListener("agent:deselect", onDeselect); };
  }, [moveAgent, select, workspaceQuery.data, queryClient]);
  useEffect(() => { (window as Window & { selectedAgentId?: string }).selectedAgentId = selectedId; }, [selectedId]);
  useEffect(() => {
    const started = (event: Event) => void api.startInteraction((event as CustomEvent<{ interactionId: string }>).detail.interactionId);
    const completed = (event: Event) => void api.completeInteraction((event as CustomEvent<{ interactionId: string }>).detail.interactionId);
    const failed = (event: Event) => void api.failInteraction((event as CustomEvent<{ interactionId: string }>).detail.interactionId);
    window.addEventListener("interaction:started", started); window.addEventListener("interaction:completed", completed); window.addEventListener("interaction:failed", failed);
    return () => { window.removeEventListener("interaction:started", started); window.removeEventListener("interaction:completed", completed); window.removeEventListener("interaction:failed", failed); };
  }, []);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!selectedId || (over?.id !== "selected-agent" && over?.id !== "scene")) return;
    assignSkill(selectedId, String(active.id));
    const skill = skills.find((item) => item.id === active.id);
    setEvents((items) => [`${skill?.name} atribuída a ${selected?.name}.`, ...items].slice(0, 10));
    void api.assignSkill(selectedId, String(active.id)).then(invalidateAgents).catch(() => setEvents((items) => ["Skill já atribuída ou backend indisponível.", ...items].slice(0, 10)));
  };
  const sendTask = () => {
    if (!selected || !task.trim()) return;
    const prompt = task.trim(); setTask(selected.id, prompt); setEvents((items) => [`Tarefa em fila para ${selected.name}: ${prompt}`, ...items].slice(0, 10)); setTaskDraft("");
    void api.createTask(selected.id, prompt, taskAccess).catch(() => setEvents((items) => ["Não foi possível iniciar o Codex local.", ...items].slice(0, 10)));
  };
  const createAgent = async (form: AgentForm) => {
    if (!workspaceQuery.data) throw new Error("Backend local indisponível");
    await api.createAgent(workspaceQuery.data.id, form); await invalidateAgents();
  };
  const deleteSelected = () => {
    if (!selected) return;
    removeSelected(); void api.deleteAgent(selected.id).then(invalidateAgents);
  };
  const requestInteraction = () => {
    if (!selected || !interactionTarget || !interactionSummary.trim()) return;
    void api.createInteraction(selected.id, interactionTarget, interactionSummary.trim()).catch(() => setEvents((items) => ["Interação indisponível: um agente já está ocupado.", ...items].slice(0, 10)));
  };
  const assignPlugin = (pluginId: string) => {
    if (!selected) return;
    void api.assignPlugin(selected.id, pluginId).then(invalidateAgents).catch(() => setEvents((items) => ["Plugin já atribuído ou incompatível.", ...items].slice(0, 10)));
  };
  const removeSkill = (skillId: string) => {
    if (!selected) return;
    void api.removeSkill(selected.id, skillId).then(invalidateAgents).catch(() => setEvents((items) => ["Não foi possível remover a skill.", ...items].slice(0, 10)));
  };
  const decideApproval = (approvalId: string, approved: boolean) => void api.decideApproval(approvalId, approved).then(() => queryClient.invalidateQueries({ queryKey: ["approvals", workspaceQuery.data?.id] }));
  const cancelTask = (taskId: string) => void api.cancelTask(taskId).then(invalidateTasks);

  return <DndContext onDragEnd={onDragEnd}><main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">AR</span><div><strong>Agents Room</strong><small>workspace local</small></div></div><div className="workspace-meta"><span>Projeto: agents-room</span><span>Branch: {workspaceQuery.data?.gitBranch ?? "sem Git"}</span><span className={workspaceQuery.data ? "codex-online" : "codex-offline"}>● {workspaceQuery.data ? "Codex disponível" : "Backend desconectado"}</span><span>{agents.length}/8 agentes</span></div><div className="topbar-actions"><button className={editMode ? "button active" : "button"} onClick={toggleEdit}>{editMode ? "Concluir edição" : "Editar sala"}</button><AddAgentDialog onCreate={createAgent} /></div></header>
    <section className="workspace-grid">
      <aside className="catalog panel"><div className="panel-heading"><h2>Catálogo</h2><input aria-label="Buscar skills" placeholder="Buscar skill" /></div><p className="section-label">SKILLS LOCAIS</p>{skills.map((skill) => <DraggableSkill key={skill.id} skillId={skill.id} label={skill.name} />)}<p className="section-label">PLUGINS</p><div className="empty-plugin">Nenhum plugin instalado.<br />O catálogo será sincronizado pelo backend.</div></aside>
      <section className="scene-wrap"><div className="scene-toolbar"><span className={editMode ? "mode edit" : "mode"}>{editMode ? "Modo edição: arraste agentes para mover a estação" : "Modo operação"}</span><span>Scroll: zoom · arraste o fundo: câmera · F: foco · Esc: limpar</span></div><SceneDrop><OfficeCanvas /></SceneDrop></section>
      <aside className="inspector panel"><div className="panel-heading"><h2>Inspector</h2><span className="status-dot" /></div>{selected ? <><div className="agent-title"><span className="avatar" style={{ background: `#${selected.color.toString(16)}` }}>{selected.name[0]}</span><div><h3>{selected.name}</h3><p>{selected.role}</p></div></div><p className="description">{selected.description}</p><dl className="details"><div><dt>Estado</dt><dd>{selected.status}</dd></div><div><dt>Posição</dt><dd>{selected.position.x}, {selected.position.y}</dd></div><div><dt>Sessão</dt><dd>criada na POC</dd></div></dl><p className="section-label">SKILLS</p><SkillDropZone>{selected.skills.length ? selected.skills.map((id) => <button key={id} className="skill-chip" onClick={() => removeSkill(id)} aria-label={`Remover ${skills.find((skill) => skill.id === id)?.name}`}>{skills.find((skill) => skill.id === id)?.name} ×</button>) : <span className="empty">Arraste uma skill aqui</span>}</SkillDropZone><p className="section-label">ENVIAR TAREFA</p><textarea value={task} onChange={(event) => setTaskDraft(event.target.value)} placeholder="Descreva uma tarefa…" /><button className="primary full" onClick={sendTask}>Enviar ao Codex</button>{selected.task && <p className="task-current">Em execução: {selected.task}</p>}<button className="danger-link" onClick={deleteSelected}>Remover agente</button></> : <div className="empty-inspector">Selecione um agente na sala.</div>}</aside>
    </section>
    <section className="operation-controls panel"><label>Permissão da próxima tarefa<select value={taskAccess} onChange={(event) => setTaskAccess(event.target.value)}><option value="read_only">Somente leitura</option><option value="workspace_write">Escrita no workspace</option></select></label>{selected && pluginsQuery.data?.map((plugin) => <button key={plugin.id} className="button" onClick={() => assignPlugin(plugin.id)}>+ {plugin.name}</button>)}{tasksQuery.data?.slice(0, 2).map((item) => <div key={item.id} className="task-history"><span>{item.state}: {item.prompt}</span>{["queued", "running", "waiting_approval"].includes(item.state) && <button className="button" onClick={() => cancelTask(item.id)}>Cancelar</button>}</div>)}{approvalsQuery.data?.map((approval) => <div key={approval.id} className="approval"><span>{approval.summary}</span><button className="primary" onClick={() => decideApproval(approval.id, true)}>Aprovar</button><button className="button" onClick={() => decideApproval(approval.id, false)}>Rejeitar</button></div>)}</section>
    {selected && <section className="interaction-controls panel"><span>INTERAGIR COMO {selected.name.toUpperCase()}</span><select value={interactionTarget} onChange={(event) => setInteractionTarget(event.target.value)}><option value="">Escolha um agente</option>{agents.filter((agent) => agent.id !== selected.id).map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>)}</select><input value={interactionSummary} onChange={(event) => setInteractionSummary(event.target.value)} aria-label="Resumo da interação" /><button className="button" onClick={requestInteraction}>Solicitar interação</button></section>}
    <section className="event-panel panel"><div className="panel-heading"><h2>Eventos</h2><span>stream local</span></div><ol>{events.map((event, index) => <li key={`${event}-${index}`}><time>agora</time>{event}</li>)}</ol></section>
  </main></DndContext>;
}
