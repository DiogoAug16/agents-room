import * as Dialog from "@radix-ui/react-dialog";
import { DndContext, pointerWithin, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, websocketUrl } from "./api/client";
import { OfficeCanvas } from "./scene/office-canvas";
import { publishSceneInteraction } from "./scene/scene-events";
import { useSceneStore } from "./stores/scene-store";
import { FURNITURE_ASSETS, furnitureAsset, type FurnitureCategory } from "./scene/furniture/catalog";

const agentSchema = z.object({ name: z.string().trim().min(2, "Informe ao menos 2 caracteres"), role: z.string().trim().min(2, "Informe uma função") });
type AgentForm = z.infer<typeof agentSchema>;

function DraggableSkill({ skill, disabled, onAssign }: { skill: { id: string; name: string; description: string; category: string; manifest?: { recommendedPermission?: string } }; disabled: boolean; onAssign: (skillId: string) => void }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, isDragging } = useDraggable({ id: skill.id, disabled });
  return <div ref={setNodeRef} className="skill-card skill-dnd-card" style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.45 : 1 }}><button className="skill-assign" disabled={disabled} onClick={() => onAssign(skill.id)}><span>{skill.name}</span><small>{skill.category} · {skill.description}{skill.manifest?.recommendedPermission ? ` · ${skill.manifest.recommendedPermission}` : ""}</small></button><button ref={setActivatorNodeRef} className="skill-drag" disabled={disabled} aria-label={`Arrastar ${skill.name}`} {...listeners} {...attributes}>↕</button></div>;
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
  const furniture = useSceneStore((state) => state.furniture);
  const furnitureGroups = useSceneStore((state) => state.furnitureGroups);
  const agentSeatAssignments = useSceneStore((state) => state.agentSeatAssignments);
  const selectedFurnitureId = useSceneStore((state) => state.selectedFurnitureId);
  const addFurniture = useSceneStore((state) => state.addFurniture);
  const moveFurniture = useSceneStore((state) => state.moveFurniture);
  const removeFurniture = useSceneStore((state) => state.removeFurniture);
  const rotateFurniture = useSceneStore((state) => state.rotateFurniture);
  const selectFurniture = useSceneStore((state) => state.selectFurniture);
  const replaceOfficeLayout = useSceneStore((state) => state.replaceOfficeLayout);
  const assignAgentSeat = useSceneStore((state) => state.assignAgentSeat);
  const createWorkstationPreset = useSceneStore((state) => state.createWorkstationPreset);
  const clearFurniture = useSceneStore((state) => state.clearFurniture);
  const undoFurniture = useSceneStore((state) => state.undoFurniture);
  const redoFurniture = useSceneStore((state) => state.redoFurniture);
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({ queryKey: ["workspace"], queryFn: api.workspace, retry: false });
  const agentsQuery = useQuery({ queryKey: ["agents", workspaceQuery.data?.id], queryFn: () => api.agents(workspaceQuery.data!.id), enabled: Boolean(workspaceQuery.data), retry: false });
  const pluginsQuery = useQuery({ queryKey: ["plugins"], queryFn: api.plugins, retry: false });
  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: api.skills, retry: false });
  const approvalsQuery = useQuery({ queryKey: ["approvals", workspaceQuery.data?.id], queryFn: () => api.approvals(workspaceQuery.data!.id), enabled: Boolean(workspaceQuery.data), retry: false });
  const officeLayoutQuery = useQuery({ queryKey: ["office-layout", workspaceQuery.data?.id], queryFn: () => api.officeLayout(workspaceQuery.data!.id), enabled: Boolean(workspaceQuery.data), retry: false });
  const [task, setTaskDraft] = useState("");
  const [taskAccess, setTaskAccess] = useState("read_only");
  const [interactionTarget, setInteractionTarget] = useState("");
  const [interactionSummary, setInteractionSummary] = useState("Solicitando revisão da tarefa atual.");
  const [interactionKind, setInteractionKind] = useState<"context_share" | "delegation">("context_share");
  const [events, setEvents] = useState<string[]>(["POC Codex validada: sessão local disponível."]);
  const [lastError, setLastError] = useState<string>();
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [furnitureSearch, setFurnitureSearch] = useState("");
  const [furnitureCategory, setFurnitureCategory] = useState<FurnitureCategory | "all">("all");
  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId), [agents, selectedId]);
  const catalogSkills = skillsQuery.data ?? [];
  const filteredSkills = useMemo(() => catalogSkills.filter((skill) => (catalogCategory === "all" || skill.category === catalogCategory) && `${skill.name} ${skill.description} ${skill.category}`.toLocaleLowerCase().includes(catalogSearch.trim().toLocaleLowerCase())), [catalogCategory, catalogSearch, catalogSkills]);
  const filteredFurniture = useMemo(() => FURNITURE_ASSETS.filter((asset) => (furnitureCategory === "all" || asset.category === furnitureCategory) && asset.name.toLocaleLowerCase().includes(furnitureSearch.trim().toLocaleLowerCase())), [furnitureCategory, furnitureSearch]);
  const seatFurniture = useMemo(() => furniture.filter((item) => furnitureAsset(item.assetId)?.seat), [furniture]);
  const tasksQuery = useQuery({ queryKey: ["tasks", selectedId], queryFn: () => api.tasks(selectedId!), enabled: Boolean(selectedId), retry: false });
  const invalidateAgents = () => workspaceQuery.data && queryClient.invalidateQueries({ queryKey: ["agents", workspaceQuery.data.id] });
  const invalidateTasks = () => { if (selectedId) return queryClient.invalidateQueries({ queryKey: ["tasks", selectedId] }); };
  const reportError = (message: string) => { setLastError(message); setEvents((items) => [message, ...items].slice(0, 10)); };

  useEffect(() => { if (agentsQuery.data) replaceAgents(agentsQuery.data); }, [agentsQuery.data, replaceAgents]);
  useEffect(() => { if (officeLayoutQuery.data) replaceOfficeLayout(officeLayoutQuery.data.furnitureInstances, officeLayoutQuery.data.furnitureGroups ?? [], officeLayoutQuery.data.agentSeatAssignments ?? {}); }, [officeLayoutQuery.data, replaceOfficeLayout]);
  useEffect(() => {
    if (!workspaceQuery.data || !officeLayoutQuery.isSuccess) return;
    const timer = window.setTimeout(() => { void api.saveOfficeLayout(workspaceQuery.data!.id, furniture, furnitureGroups, agentSeatAssignments).catch(() => reportError("Não foi possível salvar o layout da sala.")); }, 350);
    return () => window.clearTimeout(timer);
  }, [agentSeatAssignments, furniture, furnitureGroups, officeLayoutQuery.isSuccess, workspaceQuery.data]);
  useEffect(() => {
    if (!workspaceQuery.data) return;
    const socket = new WebSocket(websocketUrl(workspaceQuery.data.id));
    socket.onmessage = ({ data }) => {
      const event = JSON.parse(data) as { type: string; sourceAgentId?: string; targetAgentId?: string; payload: { interactionId?: string; summary?: string } };
      setEvents((items) => [event.payload.summary ?? event.type, ...items].slice(0, 10));
      if (event.type === "task.failed") setLastError(event.payload.summary ?? "A tarefa falhou no Codex local.");
      if (event.type.startsWith("agent.") || event.type.startsWith("skill.") || event.type.startsWith("plugin.") || event.type.startsWith("task.")) void invalidateAgents();
      if (event.type.startsWith("task.")) void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (event.type.startsWith("approval.") || event.type === "task.approval.requested") void queryClient.invalidateQueries({ queryKey: ["approvals", workspaceQuery.data!.id] });
      if (event.type === "agent.interaction.requested" && event.sourceAgentId && event.targetAgentId && event.payload.interactionId && event.payload.summary) publishSceneInteraction({ interactionId: event.payload.interactionId, sourceAgentId: event.sourceAgentId, targetAgentId: event.targetAgentId, summary: event.payload.summary });
    };
    return () => socket.close();
  }, [workspaceQuery.data, queryClient]);
  useEffect(() => {
    const onSelect = (event: Event) => select((event as CustomEvent<string>).detail);
    const onMove = (event: Event) => { const { id, x, y } = (event as CustomEvent<{ id: string; x: number; y: number }>).detail; moveAgent(id, x, y); void api.moveAgent(id, x, y).then(invalidateAgents).catch(() => { void invalidateAgents(); setEvents((items) => ["A estação não pode ser movida para essa célula.", ...items].slice(0, 10)); }); setEvents((items) => [`Estação movida para (${x}, ${y}).`, ...items].slice(0, 10)); };
    const onDeselect = () => select(undefined);
    const onInvalidStation = () => setEvents((items) => ["Célula inválida para a estação.", ...items].slice(0, 10));
    const onFurnitureSelect = (event: Event) => selectFurniture((event as CustomEvent<string>).detail);
    const onFurnitureMove = (event: Event) => moveFurniture((event as CustomEvent<{ id: string; position: { x: number; y: number } }>).detail.id, (event as CustomEvent<{ id: string; position: { x: number; y: number } }>).detail.position);
    const onFurnitureInvalid = () => setEvents((items) => ["Móvel fora do piso ou sobre outro objeto.", ...items].slice(0, 10));
    window.addEventListener("agent:select", onSelect); window.addEventListener("agent:move", onMove); window.addEventListener("agent:deselect", onDeselect); window.addEventListener("station:invalid", onInvalidStation); window.addEventListener("furniture:select", onFurnitureSelect); window.addEventListener("furniture:move", onFurnitureMove); window.addEventListener("furniture:invalid", onFurnitureInvalid);
    return () => { window.removeEventListener("agent:select", onSelect); window.removeEventListener("agent:move", onMove); window.removeEventListener("agent:deselect", onDeselect); window.removeEventListener("station:invalid", onInvalidStation); window.removeEventListener("furniture:select", onFurnitureSelect); window.removeEventListener("furniture:move", onFurnitureMove); window.removeEventListener("furniture:invalid", onFurnitureInvalid); };
  }, [moveAgent, moveFurniture, select, selectFurniture, workspaceQuery.data, queryClient]);
  useEffect(() => { (window as Window & { selectedAgentId?: string }).selectedAgentId = selectedId; }, [selectedId]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!editMode || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redoFurniture() : undoFurniture(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d" && selectedFurnitureId) { event.preventDefault(); const item = furniture.find((value) => value.id === selectedFurnitureId); if (item) addFurniture(item.assetId, { x: item.position.x + 2, y: item.position.y + 2 }); }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedFurnitureId) { event.preventDefault(); removeFurniture(selectedFurnitureId); }
      if (event.key.toLowerCase() === "r" && selectedFurnitureId) { event.preventDefault(); rotateFurniture(selectedFurnitureId); }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [addFurniture, editMode, furniture, redoFurniture, removeFurniture, rotateFurniture, selectedFurnitureId, undoFurniture]);
  useEffect(() => {
    const started = (event: Event) => void api.startInteraction((event as CustomEvent<{ interactionId: string }>).detail.interactionId);
    const completed = (event: Event) => void api.completeInteraction((event as CustomEvent<{ interactionId: string }>).detail.interactionId);
    const failed = (event: Event) => void api.failInteraction((event as CustomEvent<{ interactionId: string }>).detail.interactionId);
    window.addEventListener("interaction:started", started); window.addEventListener("interaction:completed", completed); window.addEventListener("interaction:failed", failed);
    return () => { window.removeEventListener("interaction:started", started); window.removeEventListener("interaction:completed", completed); window.removeEventListener("interaction:failed", failed); };
  }, []);

  const assignSkillToSelected = (skillId: string) => {
    if (!selectedId || !selected) return;
    assignSkill(selectedId, skillId);
    const skill = catalogSkills.find((item) => item.id === skillId);
    setEvents((items) => [`${skill?.name} atribuída a ${selected?.name}.`, ...items].slice(0, 10));
    void api.assignSkill(selectedId, skillId).then(invalidateAgents).catch(() => { void invalidateAgents(); setEvents((items) => ["Skill já atribuída ou backend indisponível.", ...items].slice(0, 10)); });
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over?.id !== "selected-agent" && over?.id !== "scene") return;
    assignSkillToSelected(String(active.id));
  };
  const sendTask = () => {
    if (!selected || !task.trim()) return;
    const prompt = task.trim(); setLastError(undefined); setTask(selected.id, prompt); setEvents((items) => [`Tarefa em fila para ${selected.name}: ${prompt}`, ...items].slice(0, 10)); setTaskDraft("");
    void api.createTask(selected.id, prompt, taskAccess).then(invalidateAgents).catch((error: Error) => { void invalidateAgents(); reportError(error.message.includes("active task") ? "O agente já possui uma tarefa ativa." : "Não foi possível iniciar o Codex local."); });
  };
  const createAgent = async (form: AgentForm) => {
    if (!workspaceQuery.data) throw new Error("Backend local indisponível");
    await api.createAgent(workspaceQuery.data.id, form); await invalidateAgents();
  };
  const createWorkstation = () => {
    if (!selected) return;
    if (!createWorkstationPreset(selected.id, selected.basePosition)) { reportError("Não há espaço livre para montar esta estação."); return; }
    setEvents((items) => [`Estação completa criada para ${selected.name}.`, ...items].slice(0, 10));
  };
  const deleteSelected = () => {
    if (!selected) return;
    removeSelected(); void api.deleteAgent(selected.id).then(invalidateAgents);
  };
  const requestInteraction = () => {
    if (!selected || !interactionTarget || !interactionSummary.trim()) return;
    const summary = interactionSummary.trim();
    const activeTask = tasksQuery.data?.find((item) => ["queued", "starting", "running", "waiting_approval"].includes(item.state));
    if (interactionKind === "delegation" && !activeTask) { reportError("Crie uma tarefa ativa antes de delegar."); return; }
    const request = interactionKind === "delegation" ? api.delegateTask(activeTask!.id, interactionTarget, summary, summary) : api.createInteraction(selected.id, interactionTarget, summary);
    void request.then(() => setLastError(undefined)).catch(() => reportError(interactionKind === "delegation" ? "Delegação bloqueada por limite, ciclo ou agente ocupado." : "Interação indisponível: um agente já está ocupado."));
  };
  const assignPlugin = (pluginId: string) => {
    if (!selected) return;
    void api.assignPlugin(selected.id, pluginId).then(invalidateAgents).catch(() => setEvents((items) => ["Plugin já atribuído ou incompatível.", ...items].slice(0, 10)));
  };
  const removePlugin = (pluginId: string) => {
    if (!selected) return;
    void api.removePlugin(selected.id, pluginId).then(invalidateAgents).catch(() => setEvents((items) => ["Não foi possível remover o plugin.", ...items].slice(0, 10)));
  };
  const updatePlugin = (pluginId: string, enabled: boolean) => {
    if (!selected) return;
    void api.updatePlugin(selected.id, pluginId, enabled).then(invalidateAgents).catch(() => setEvents((items) => ["Não foi possível atualizar o plugin.", ...items].slice(0, 10)));
  };
  const removeSkill = (skillId: string) => {
    if (!selected) return;
    void api.removeSkill(selected.id, skillId).then(invalidateAgents).catch(() => setEvents((items) => ["Não foi possível remover a skill.", ...items].slice(0, 10)));
  };
  const updateSkill = (skillId: string, enabled: boolean) => {
    if (!selected) return;
    void api.updateSkill(selected.id, skillId, enabled).then(invalidateAgents).catch(() => setEvents((items) => ["Não foi possível atualizar a skill.", ...items].slice(0, 10)));
  };
  const decideApproval = (approvalId: string, approved: boolean) => void api.decideApproval(approvalId, approved).then(() => queryClient.invalidateQueries({ queryKey: ["approvals", workspaceQuery.data?.id] }));
  const cancelTask = (taskId: string) => void api.cancelTask(taskId).then(invalidateTasks);

  return <DndContext collisionDetection={pointerWithin} onDragEnd={onDragEnd}><main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">AR</span><div><strong>Agents Room</strong><small>workspace local</small></div></div><div className="workspace-meta"><span>Projeto: agents-room</span><span>Branch: {workspaceQuery.data?.gitBranch ?? "sem Git"}</span><span className={workspaceQuery.data ? "codex-online" : "codex-offline"}>● {workspaceQuery.data ? "Codex disponível" : "Backend desconectado"}</span><span>{agents.length}/8 agentes</span></div><div className="topbar-actions"><label className="agent-selector"><span>Agente</span><select aria-label="Agente selecionado" value={selectedId ?? ""} onChange={(event) => select(event.target.value || undefined)}><option value="" disabled>Selecionar</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>)}</select></label><button className={editMode ? "button active" : "button"} onClick={toggleEdit}>{editMode ? "Concluir edição" : "Editar sala"}</button><AddAgentDialog onCreate={createAgent} /></div></header>
    <section className="workspace-grid">
      <aside className="catalog panel"><div className="panel-heading"><h2>Catálogo</h2><input aria-label="Buscar skills" placeholder="Buscar skill" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} /></div><select className="catalog-filter" aria-label="Filtrar skills por categoria" value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)}><option value="all">Todas as categorias</option>{[...new Set(catalogSkills.map((skill) => skill.category))].map((category) => <option key={category} value={category}>{category}</option>)}</select><p className="section-label">SKILLS LOCAIS</p>{filteredSkills.length ? filteredSkills.map((skill) => <DraggableSkill key={skill.id} skill={skill} disabled={!selected} onAssign={assignSkillToSelected} />) : <div className="empty-plugin">Nenhuma skill encontrada.</div>}<p className="section-label">MÓVEIS</p><input aria-label="Buscar móveis" placeholder="Buscar móvel" value={furnitureSearch} onChange={(event) => setFurnitureSearch(event.target.value)} /><select className="catalog-filter" aria-label="Filtrar móveis por categoria" value={furnitureCategory} onChange={(event) => setFurnitureCategory(event.target.value as FurnitureCategory | "all")}><option value="all">Todas as categorias</option>{[...new Set(FURNITURE_ASSETS.map((asset) => asset.category))].map((category) => <option key={category} value={category}>{category}</option>)}</select>{filteredFurniture.map((asset) => <button key={asset.id} className="skill-card" disabled={!editMode} onClick={() => addFurniture(asset.id, { x: 18, y: 20 })}><span>+ {asset.name}</span><small>{asset.category}{asset.seat ? " · possui assento" : ""} · {furniture.filter((item) => item.assetId === asset.id).length} na sala</small></button>)}<div className="furniture-actions"><button className="primary" disabled={!editMode || !selected} onClick={createWorkstation}>Montar estação</button><button className="button" disabled={!editMode} onClick={undoFurniture}>Desfazer</button><button className="button" disabled={!editMode} onClick={redoFurniture}>Refazer</button><button className="button" disabled={!editMode} onClick={clearFurniture}>Limpar</button></div>{selectedFurnitureId && <div className="furniture-actions"><button className="button" onClick={() => rotateFurniture(selectedFurnitureId)}>Rotacionar</button><button className="button" onClick={() => { const item = furniture.find((value) => value.id === selectedFurnitureId); if (item) addFurniture(item.assetId, { x: item.position.x + 2, y: item.position.y + 2 }); }}>Duplicar</button><button className="danger-link" onClick={() => removeFurniture(selectedFurnitureId)}>Excluir</button></div>}<p className="section-label">PLUGINS</p>{pluginsQuery.data?.length ? pluginsQuery.data.map((plugin) => <button key={plugin.id} className="skill-card" onClick={() => assignPlugin(plugin.id)} disabled={!selected}><span>+ {plugin.name}</span><small>{plugin.description} · {plugin.manifest.permissions?.join(", ")}</small></button>) : <div className="empty-plugin">Nenhum plugin disponível.</div>}</aside>
      <section className="scene-wrap"><div className="scene-toolbar"><span className={editMode ? "mode edit" : "mode"}>{editMode ? "Modo edição: arraste agentes para mover a estação" : "Modo operação"}</span><span>Scroll: zoom · arraste o fundo: câmera · F: foco · Esc: limpar{import.meta.env.DEV ? " · N: mapa" : ""}</span></div><SceneDrop><OfficeCanvas /></SceneDrop></section>
      <aside className="inspector panel"><div className="panel-heading"><h2>Inspector</h2>{selected && <span className={`status-dot ${selected.status}`} aria-label={`Estado: ${selected.status}`} />}</div>{selected ? <><div className="agent-title"><span className="avatar" style={{ background: `#${selected.color.toString(16)}` }}>{selected.name[0]}</span><div><h3>{selected.name}</h3><p>{selected.role}</p></div></div><p className="description">{selected.description}</p><dl className="details"><div><dt>Estado</dt><dd>{selected.status}</dd></div><div><dt>Posição</dt><dd>{selected.position.x}, {selected.position.y}</dd></div><div><dt>Sessão</dt><dd>{selected.sessionId ? `Codex ${selected.sessionId.slice(0, 8)}` : "criada ao iniciar tarefa"}</dd></div></dl><p className="section-label">ESTAÇÃO</p><label>Cadeira principal<select aria-label="Cadeira principal" value={agentSeatAssignments[selected.id] ?? ""} onChange={(event) => assignAgentSeat(selected.id, event.target.value || undefined)}><option value="">Sem cadeira associada</option>{seatFurniture.filter((item) => !Object.entries(agentSeatAssignments).some(([agentId, seatId]) => agentId !== selected.id && seatId === item.id)).map((item) => <option key={item.id} value={item.id}>{furnitureAsset(item.assetId)?.name} · {item.position.x}, {item.position.y}</option>)}</select></label><p className="section-label">SKILLS</p><SkillDropZone>{selected.skillStates.length ? selected.skillStates.map(({ id, enabled }) => <span key={id} className={enabled ? "skill-chip" : "skill-chip disabled"}>{catalogSkills.find((skill) => skill.id === id)?.name ?? id}<button onClick={() => updateSkill(id, !enabled)}>{enabled ? "Pausar" : "Ativar"}</button><button onClick={() => removeSkill(id)} aria-label={`Remover ${catalogSkills.find((skill) => skill.id === id)?.name ?? id}`}>×</button></span>) : <span className="empty">Arraste uma skill aqui</span>}</SkillDropZone><p className="section-label">PLUGINS</p><div className="skill-list">{selected.pluginStates.length ? selected.pluginStates.map(({ id, name, enabled }) => <span key={id} className={enabled ? "skill-chip" : "skill-chip disabled"}>{name}<button onClick={() => updatePlugin(id, !enabled)}>{enabled ? "Pausar" : "Ativar"}</button><button onClick={() => removePlugin(id)} aria-label={`Remover ${name}`}>×</button></span>) : <span className="empty">Nenhum plugin atribuído</span>}</div><p className="section-label">ENVIAR TAREFA</p><textarea value={task} onChange={(event) => setTaskDraft(event.target.value)} placeholder="Descreva uma tarefa…" /><button className="primary full" onClick={sendTask}>Enviar ao Codex</button>{selected.task && <p className="task-current">Em execução: {selected.task}</p>}<button className="danger-link" onClick={deleteSelected}>Remover agente</button></> : <div className="empty-inspector">Selecione um agente na sala.</div>}</aside>
    </section>
    <section className="operation-controls panel"><label>Permissão da próxima tarefa<select value={taskAccess} onChange={(event) => setTaskAccess(event.target.value)}><option value="read_only">Somente leitura</option><option value="workspace_write">Escrita no workspace</option></select></label>{tasksQuery.data?.slice(0, 2).map((item) => <div key={item.id} className="task-history"><span>{item.state}: {item.prompt}</span>{["queued", "running", "waiting_approval"].includes(item.state) && <button className="button" onClick={() => cancelTask(item.id)}>Cancelar</button>}</div>)}{approvalsQuery.data?.map((approval) => <div key={approval.id} className="approval"><span>{approval.summary}</span><button className="primary" onClick={() => decideApproval(approval.id, true)}>Aprovar</button><button className="button" onClick={() => decideApproval(approval.id, false)}>Rejeitar</button></div>)}</section>
    {selected && <section className="interaction-controls panel"><span>INTERAGIR COMO {selected.name.toUpperCase()}</span><select aria-label="Tipo da interação" value={interactionKind} onChange={(event) => setInteractionKind(event.target.value as "context_share" | "delegation")}><option value="context_share">Compartilhar contexto</option><option value="delegation">Delegar subtarefa</option></select><select aria-label="Agente de destino" value={interactionTarget} onChange={(event) => setInteractionTarget(event.target.value)}><option value="">Escolha um agente</option>{agents.filter((agent) => agent.id !== selected.id).map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>)}</select><input value={interactionSummary} onChange={(event) => setInteractionSummary(event.target.value)} aria-label="Resumo da interação" /><button className="button" onClick={requestInteraction}>{interactionKind === "delegation" ? "Delegar subtarefa" : "Solicitar interação"}</button></section>}
    <section className="event-panel panel">{lastError && <p className="error-banner" role="alert">{lastError}<button aria-label="Fechar erro" onClick={() => setLastError(undefined)}>×</button></p>}<div className="panel-heading"><h2>Eventos</h2><span>stream local</span></div><ol aria-live="polite">{events.map((event, index) => <li key={`${event}-${index}`}><time>agora</time>{event}</li>)}</ol></section>
  </main></DndContext>;
}
