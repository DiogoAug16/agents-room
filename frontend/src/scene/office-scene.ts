import Phaser from "phaser";
import type { Agent } from "../types";
import { GRID_HEIGHT, GRID_WIDTH, TILE_HEIGHT, TILE_WIDTH, gridToScreen, isInsideGrid, screenToGrid } from "./grid";
import { sceneEvents } from "./scene-events";
import { useSceneStore } from "../stores/scene-store";
import { cellKey, findPath } from "./pathfinding";
import type { SceneInteraction } from "./scene-events";

type DrawnAgent = { body: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Sprite; status: Phaser.GameObjects.Arc; data: Agent };

export class OfficeScene extends Phaser.Scene {
  private agents = new Map<string, DrawnAgent>();
  private editMode = false;
  private draggingCamera = false;
  private lastPointer = new Phaser.Math.Vector2();
  private activeInteractions = new Set<string>();
  private readonly furnitureCells = new Set(["10,7", "11,7", "12,7", "13,7", "10,8", "11,8", "12,8", "13,8"]);

  constructor() { super("office"); }

  preload() {
    this.load.image("office", "/cenario_completo.png");
    [1, 2, 3].forEach((index) => this.load.spritesheet(`agent-${index}`, `/personagem_${index}_asset.png`, { frameWidth: 256, frameHeight: 256 }));
  }

  create() {
    const background = this.add.image(0, 0, "office").setOrigin(0).setScale(0.75).setDepth(-100);
    background.setInteractive();
    this.createCharacterAnimations();
    this.drawGrid();
    this.cameras.main.setBounds(-80, -80, background.displayWidth + 160, background.displayHeight + 160);
    this.cameras.main.setZoom(0.72);
    this.input.on("wheel", (_: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.55, 1.15)));
    background.on("pointerdown", (pointer: Phaser.Input.Pointer) => { this.draggingCamera = true; this.lastPointer.set(pointer.x, pointer.y); });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.draggingCamera) return;
      this.cameras.main.scrollX -= (pointer.x - this.lastPointer.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (pointer.y - this.lastPointer.y) / this.cameras.main.zoom;
      this.lastPointer.set(pointer.x, pointer.y);
    });
    this.input.on("pointerup", () => { this.draggingCamera = false; });
    sceneEvents.addEventListener("agents", this.sync as EventListener);
    sceneEvents.addEventListener("interaction", this.interact as EventListener);
    this.sync(new CustomEvent("agents", { detail: { agents: useSceneStore.getState().agents, editMode: useSceneStore.getState().editMode } }));
    this.input.keyboard?.on("keydown-F", () => this.focusSelected());
    this.input.keyboard?.on("keydown-ESC", () => window.dispatchEvent(new Event("agent:deselect")));
  }

  shutdown() { sceneEvents.removeEventListener("agents", this.sync as EventListener); sceneEvents.removeEventListener("interaction", this.interact as EventListener); }

  private drawGrid() {
    const graphics = this.add.graphics().setDepth(-50).setAlpha(0.18);
    for (let x = 0; x < GRID_WIDTH; x++) for (let y = 0; y < GRID_HEIGHT; y++) {
      const point = gridToScreen({ x, y });
      graphics.lineStyle(1, 0xffffff).strokePoints([
        new Phaser.Geom.Point(point.x, point.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(point.x + TILE_WIDTH / 2, point.y), new Phaser.Geom.Point(point.x, point.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(point.x - TILE_WIDTH / 2, point.y), new Phaser.Geom.Point(point.x, point.y - TILE_HEIGHT / 2),
      ]);
    }
  }

  private sync = (event: Event) => {
    const { agents, editMode } = (event as CustomEvent<{ agents: Agent[]; editMode: boolean }>).detail;
    this.editMode = editMode;
    const currentIds = new Set(agents.map((agent) => agent.id));
    this.agents.forEach(({ body }, id) => { if (!currentIds.has(id)) { body.destroy(); this.agents.delete(id); } });
    agents.forEach((agent) => this.drawAgent(agent));
  };

  private drawAgent(agent: Agent) {
    const screen = gridToScreen(agent.position);
    let drawn = this.agents.get(agent.id);
    if (!drawn) {
      const shadow = this.add.ellipse(0, 5, 38, 12, 0x15202b, 0.28);
      const sprite = this.add.sprite(0, 0, this.textureFor(agent)).setOrigin(0.5, 0.9).setScale(0.38);
      const label = this.add.text(0, -108, agent.name, { fontFamily: "Inter, sans-serif", fontSize: "16px", color: "#f6f8fb", stroke: "#13202c", strokeThickness: 4 }).setOrigin(0.5);
      const status = this.add.circle(31, -84, 5, this.statusColor(agent.status));
      const container = this.add.container(screen.x, screen.y, [shadow, sprite, label, status]).setSize(76, 108).setInteractive({ useHandCursor: true });
      container.on("pointerdown", (pointer: Phaser.Input.Pointer) => { pointer.event.stopPropagation(); window.dispatchEvent(new CustomEvent("agent:select", { detail: agent.id })); });
      container.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (this.editMode) this.moveToCell(agent.id, pointer); });
      container.on("pointerover", () => container.setScale(1.08));
      container.on("pointerout", () => container.setScale(1));
      drawn = { body: container, sprite, status, data: agent };
      this.agents.set(agent.id, drawn);
    }
    drawn.data = agent;
    drawn.body.setDepth(screen.y);
    drawn.status.setFillStyle(this.statusColor(agent.status));
    this.playVisualState(drawn.sprite, agent);
    this.tweens.add({ targets: drawn.body, x: screen.x, y: screen.y, duration: 240, ease: "Sine.out" });
  }

  private moveToCell(id: string, pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = screenToGrid(point.x, point.y);
    if (isInsideGrid(cell)) window.dispatchEvent(new CustomEvent("agent:move", { detail: { id, ...cell } }));
  }

  private interact = (event: Event) => { void this.runInteraction((event as CustomEvent<SceneInteraction>).detail); };

  private async runInteraction(interaction: SceneInteraction) {
    if (this.activeInteractions.has(interaction.interactionId)) return;
    const source = this.agents.get(interaction.sourceAgentId);
    const target = this.agents.get(interaction.targetAgentId);
    if (!source || !target || this.activeInteractions.has(source.data.id) || this.activeInteractions.has(target.data.id)) return;
    const blocked = new Set(this.furnitureCells);
    this.agents.forEach(({ data }, id) => { if (id !== source.data.id) blocked.add(cellKey(data.position)); });
    const destination = [{ x: target.data.position.x, y: target.data.position.y + 1 }, { x: target.data.position.x + 1, y: target.data.position.y }, { x: target.data.position.x - 1, y: target.data.position.y }, { x: target.data.position.x, y: target.data.position.y - 1 }].find((cell) => isInsideGrid(cell) && !blocked.has(cellKey(cell)));
    if (!destination) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
    const route = findPath(source.data.position, destination, blocked);
    if (!route) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
    this.activeInteractions.add(interaction.interactionId); this.activeInteractions.add(source.data.id); this.activeInteractions.add(target.data.id);
    window.dispatchEvent(new CustomEvent("interaction:started", { detail: interaction }));
    await this.walk(source, route);
    target.sprite.stop().setFrame(8);
    const bubble = this.add.text(target.body.x, target.body.y - 138, interaction.summary, { fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#18252c", backgroundColor: "#f5fbfd", wordWrap: { width: 260 }, padding: { x: 10, y: 7 } }).setOrigin(0.5).setDepth(99999);
    await this.wait(1600);
    bubble.destroy();
    const returnBlocked = new Set(this.furnitureCells);
    this.agents.forEach(({ data }, id) => { if (id !== source.data.id) returnBlocked.add(cellKey(data.position)); });
    const returnRoute = findPath(destination, source.data.basePosition, returnBlocked);
    if (returnRoute) await this.walk(source, returnRoute);
    this.playVisualState(source.sprite, { ...source.data, status: "working" });
    this.activeInteractions.delete(interaction.interactionId); this.activeInteractions.delete(source.data.id); this.activeInteractions.delete(target.data.id);
    window.dispatchEvent(new CustomEvent("interaction:completed", { detail: interaction }));
  }

  private async walk(agent: DrawnAgent, route: Agent["position"][]) {
    for (let index = 1; index < route.length; index++) {
      const previous = route[index - 1], next = route[index];
      agent.sprite.play(`${this.textureFor(agent.data)}-walk-${next.x > previous.x ? "east" : next.x < previous.x ? "west" : next.y > previous.y ? "south" : "north"}`, true);
      const screen = gridToScreen(next);
      await new Promise<void>((resolve) => this.tweens.add({ targets: agent.body, x: screen.x, y: screen.y, duration: 180, ease: "Sine.out", onComplete: () => resolve() }));
    }
    agent.sprite.stop();
  }

  private wait(milliseconds: number) { return new Promise<void>((resolve) => this.time.delayedCall(milliseconds, resolve)); }

  private textureFor(agent: Agent) { return `agent-${([...this.agents.keys(), agent.id].indexOf(agent.id) % 3) + 1}`; }

  private createCharacterAnimations() {
    [1, 2, 3].forEach((index) => {
      const texture = `agent-${index}`;
      (["north", "south", "east", "west"] as const).forEach((direction, row) => this.anims.create({ key: `${texture}-walk-${direction}`, frames: this.anims.generateFrameNumbers(texture, { start: row * 8, end: row * 8 + 7 }), frameRate: 8, repeat: -1 }));
      this.anims.create({ key: `${texture}-typing-south`, frames: this.anims.generateFrameNumbers(texture, { start: 42, end: 47 }), frameRate: 5, repeat: -1 });
    });
  }

  private playVisualState(sprite: Phaser.GameObjects.Sprite, agent: Agent) {
    const texture = this.textureFor(agent);
    if (agent.status === "walking" || agent.status === "returning") sprite.play(`${texture}-walk-${agent.direction}`, true);
    else if (agent.status === "working") sprite.play(`${texture}-typing-south`, true);
    else { sprite.stop(); sprite.setFrame(agent.status === "seated" ? 40 : 8); }
  }

  private focusSelected() {
    const selected = [...this.agents.values()].find(({ data }) => data.id === (window as Window & { selectedAgentId?: string }).selectedAgentId);
    if (selected) this.cameras.main.pan(selected.body.x, selected.body.y, 250, "Sine.easeInOut");
  }

  private statusColor(status: Agent["status"]) {
    const colors: Partial<Record<Agent["status"], number>> = { working: 0x4cae9b, waiting_approval: 0xd89a34, error: 0xd35c5c, completed: 0x6aa9e9 };
    return colors[status] ?? 0x8798a5;
  }
}
