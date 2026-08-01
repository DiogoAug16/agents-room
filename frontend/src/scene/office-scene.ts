import Phaser from "phaser";
import type { Agent } from "../types";
import { GRID_HEIGHT, GRID_WIDTH, TILE_HEIGHT, TILE_WIDTH, gridToScreen, isInsideGrid, screenToGrid } from "./grid";
import { sceneEvents } from "./scene-events";
import { useSceneStore } from "../stores/scene-store";
import { cellKey, findPath, releaseAgentReservations, releaseReservation, reserveRoute, reservedByOthers } from "./pathfinding";
import type { SceneInteraction } from "./scene-events";
import { isCheckerboardPixel } from "./character-sheet";
import { clearEdgeConnectedBackdrop } from "./alpha-mask";
import { isValidStationCell } from "./station-layout";

type DrawnAgent = { body: Phaser.GameObjects.Container; station: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Sprite; status: Phaser.GameObjects.Arc; data: Agent };

export class OfficeScene extends Phaser.Scene {
  private agents = new Map<string, DrawnAgent>();
  private editMode = false;
  private draggingCamera = false;
  private lastPointer = new Phaser.Math.Vector2();
  private activeInteractions = new Set<string>();
  private routeReservations = new Map<string, string>();
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private stationPreview?: Phaser.GameObjects.Graphics;
  private stationDrag?: string;
  private readonly furnitureCells = new Set(["10,7", "11,7", "12,7", "13,7", "10,8", "11,8", "12,8", "13,8"]);

  constructor() { super("office"); }

  preload() {
    const assetPath = window.location.protocol === "file:" ? "./" : "/";
    this.load.image("office", `${assetPath}cenario_completo.png`);
    this.load.image("office-modular", `${assetPath}assets_cenario_2_modular.png`);
    [1, 2, 3].forEach((index) => this.load.spritesheet(`agent-${index}`, `${assetPath}personagem_${index}_asset.png`, { frameWidth: 256, frameHeight: 256 }));
  }

  create() {
    const background = this.add.image(0, 0, "office").setOrigin(0).setScale(0.75).setDepth(-100);
    background.setInteractive();
    this.cleanCharacterSheets();
    this.createStationTextures();
    this.createCharacterAnimations();
    this.drawGrid();
    this.cameras.main.setBounds(-80, -80, background.displayWidth + 160, background.displayHeight + 160);
    this.cameras.main.setZoom(0.72);
    this.input.on("wheel", (_: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.55, 1.15)));
    background.on("pointerdown", (pointer: Phaser.Input.Pointer) => { this.draggingCamera = true; this.lastPointer.set(pointer.x, pointer.y); });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.stationDrag) { this.previewStation(this.stationDrag, pointer); return; }
      if (!this.draggingCamera) return;
      this.cameras.main.scrollX -= (pointer.x - this.lastPointer.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (pointer.y - this.lastPointer.y) / this.cameras.main.zoom;
      this.lastPointer.set(pointer.x, pointer.y);
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.stationDrag) { this.moveToCell(this.stationDrag, pointer); this.stationDrag = undefined; this.stationPreview?.clear(); }
      this.draggingCamera = false;
    });
    sceneEvents.addEventListener("agents", this.sync as EventListener);
    sceneEvents.addEventListener("interaction", this.interact as EventListener);
    this.sync(new CustomEvent("agents", { detail: { agents: useSceneStore.getState().agents, editMode: useSceneStore.getState().editMode } }));
    this.input.keyboard?.on("keydown-F", () => this.focusSelected());
    this.input.keyboard?.on("keydown-ESC", () => window.dispatchEvent(new Event("agent:deselect")));
  }

  shutdown() { sceneEvents.removeEventListener("agents", this.sync as EventListener); sceneEvents.removeEventListener("interaction", this.interact as EventListener); }

  private drawGrid() {
    const graphics = this.add.graphics().setDepth(-50).setAlpha(0.48).setVisible(false);
    for (let x = 0; x < GRID_WIDTH; x++) for (let y = 0; y < GRID_HEIGHT; y++) {
      const point = gridToScreen({ x, y });
      graphics.lineStyle(2, 0x9ad9e6, 0.72).strokePoints([
        new Phaser.Geom.Point(point.x, point.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(point.x + TILE_WIDTH / 2, point.y), new Phaser.Geom.Point(point.x, point.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(point.x - TILE_WIDTH / 2, point.y), new Phaser.Geom.Point(point.x, point.y - TILE_HEIGHT / 2),
      ]);
    }
    this.gridGraphics = graphics;
  }

  private sync = (event: Event) => {
    const { agents, editMode } = (event as CustomEvent<{ agents: Agent[]; editMode: boolean }>).detail;
    this.editMode = editMode;
    this.gridGraphics?.setVisible(editMode);
    if (!editMode) { this.stationDrag = undefined; this.stationPreview?.clear(); }
    const currentIds = new Set(agents.map((agent) => agent.id));
    this.agents.forEach(({ body, station }, id) => { if (!currentIds.has(id)) { body.destroy(); station.destroy(); this.agents.delete(id); } });
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
      const station = this.createStationMarker(screen);
      container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        window.dispatchEvent(new CustomEvent("agent:select", { detail: agent.id }));
        if (this.editMode) { this.stationDrag = agent.id; this.previewStation(agent.id, pointer); }
      });
      container.on("pointerover", () => container.setScale(1.08));
      container.on("pointerout", () => container.setScale(1));
      drawn = { body: container, station, sprite, status, data: agent };
      this.agents.set(agent.id, drawn);
    }
    drawn.data = agent;
    drawn.body.setDepth(screen.y);
    drawn.station.setPosition(screen.x, screen.y).setDepth(screen.y - 1).setVisible(this.editMode);
    drawn.status.setFillStyle(this.statusColor(agent.status));
    this.playVisualState(drawn.sprite, agent);
    this.tweens.add({ targets: drawn.body, x: screen.x, y: screen.y, duration: 240, ease: "Sine.out" });
  }

  private moveToCell(id: string, pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = screenToGrid(point.x, point.y);
    if (!this.isStationCellValid(id, cell)) { window.dispatchEvent(new CustomEvent("station:invalid", { detail: cell })); return; }
    window.dispatchEvent(new CustomEvent("agent:move", { detail: { id, ...cell } }));
  }

  private createStationMarker(screen: Agent["position"]) {
    const point = gridToScreen(screen);
    const desk = this.add.sprite(-14, 4, "station-desk").setOrigin(0.5, 0.82).setScale(0.35);
    const chair = this.add.sprite(18, 10, "station-chair").setOrigin(0.5, 0.82).setScale(0.35);
    return this.add.container(point.x, point.y, [desk, chair]).setVisible(false);
  }

  private previewStation(agentId: string, pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = screenToGrid(point.x, point.y);
    const screen = gridToScreen(cell);
    if (!this.stationPreview) this.stationPreview = this.add.graphics().setDepth(9999);
    const valid = this.isStationCellValid(agentId, cell);
    this.stationPreview.clear().fillStyle(valid ? 0x4cae9b : 0xd35c5c, 0.38).lineStyle(2, valid ? 0x9de2d2 : 0xffaaa4, 0.9).fillPoints([
      new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(screen.x + TILE_WIDTH / 2, screen.y), new Phaser.Geom.Point(screen.x, screen.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(screen.x - TILE_WIDTH / 2, screen.y),
    ], true).strokePoints([
      new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(screen.x + TILE_WIDTH / 2, screen.y), new Phaser.Geom.Point(screen.x, screen.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(screen.x - TILE_WIDTH / 2, screen.y), new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT / 2),
    ]);
  }

  private isStationCellValid(agentId: string, cell: Agent["position"]) {
    return isValidStationCell(cell, agentId, [...this.agents.values()].map(({ data }) => data), this.furnitureCells);
  }

  private interact = (event: Event) => { void this.runInteraction((event as CustomEvent<SceneInteraction>).detail); };

  private async runInteraction(interaction: SceneInteraction) {
    if (this.activeInteractions.has(interaction.interactionId)) return;
    const source = this.agents.get(interaction.sourceAgentId);
    const target = this.agents.get(interaction.targetAgentId);
    if (!source || !target || this.activeInteractions.has(source.data.id) || this.activeInteractions.has(target.data.id)) return;
    const blocked = this.blockedCellsFor(source.data.id);
    const destination = [{ x: target.data.position.x, y: target.data.position.y + 1 }, { x: target.data.position.x + 1, y: target.data.position.y }, { x: target.data.position.x - 1, y: target.data.position.y }, { x: target.data.position.x, y: target.data.position.y - 1 }].find((cell) => isInsideGrid(cell) && !blocked.has(cellKey(cell)));
    if (!destination) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
    const route = this.planRoute(source.data.id, source.data.position, destination);
    if (!route) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
    this.activeInteractions.add(interaction.interactionId); this.activeInteractions.add(source.data.id); this.activeInteractions.add(target.data.id);
    window.dispatchEvent(new CustomEvent("interaction:started", { detail: interaction }));
    try {
      await this.walk(source, route);
      target.sprite.stop().setFrame(8);
      const bubble = this.add.text(target.body.x, target.body.y - 138, interaction.summary, { fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#18252c", backgroundColor: "#f5fbfd", wordWrap: { width: 260 }, padding: { x: 10, y: 7 } }).setOrigin(0.5).setDepth(99999);
      await this.wait(1600);
      bubble.destroy();
      const returnRoute = this.planRoute(source.data.id, destination, source.data.basePosition);
      if (!returnRoute) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
      await this.walk(source, returnRoute);
      this.playVisualState(source.sprite, { ...source.data, status: "working" });
      window.dispatchEvent(new CustomEvent("interaction:completed", { detail: interaction }));
    } finally {
      releaseAgentReservations(this.routeReservations, source.data.id);
      this.activeInteractions.delete(interaction.interactionId); this.activeInteractions.delete(source.data.id); this.activeInteractions.delete(target.data.id);
    }
  }

  private async walk(agent: DrawnAgent, route: Agent["position"][]) {
    for (let index = 1; index < route.length; index++) {
      const previous = route[index - 1], next = route[index];
      agent.sprite.play(`${this.textureFor(agent.data)}-walk-${next.x > previous.x ? "east" : next.x < previous.x ? "west" : next.y > previous.y ? "south" : "north"}`, true);
      const screen = gridToScreen(next);
      await new Promise<void>((resolve) => this.tweens.add({ targets: agent.body, x: screen.x, y: screen.y, duration: 180, ease: "Sine.out", onComplete: () => resolve() }));
      releaseReservation(this.routeReservations, agent.data.id, previous);
    }
    agent.sprite.stop();
  }

  private blockedCellsFor(agentId: string) {
    const blocked = new Set(this.furnitureCells);
    this.agents.forEach(({ data }, id) => { if (id !== agentId) blocked.add(cellKey(data.position)); });
    reservedByOthers(this.routeReservations, agentId).forEach((cell) => blocked.add(cell));
    return blocked;
  }

  private planRoute(agentId: string, start: Agent["position"], goal: Agent["position"]) {
    // ponytail: two attempts cover synchronous contention; queue routes if traffic grows.
    for (let attempt = 0; attempt < 2; attempt++) {
      const route = findPath(start, goal, this.blockedCellsFor(agentId));
      if (!route) return null;
      if (reserveRoute(this.routeReservations, agentId, route)) return route;
    }
    return null;
  }

  private wait(milliseconds: number) { return new Promise<void>((resolve) => this.time.delayedCall(milliseconds, resolve)); }

  private textureFor(agent: Agent) { return `agent-${([...this.agents.keys(), agent.id].indexOf(agent.id) % 3) + 1}-clean`; }

  private cleanCharacterSheets() {
    [1, 2, 3].forEach((index) => {
      const source = this.textures.get(`agent-${index}`).getSourceImage() as CanvasImageSource;
      const canvas = document.createElement("canvas"); canvas.width = 2048; canvas.height = 2048;
      const context = canvas.getContext("2d")!;
      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, 2048, 2048);
      for (let offset = 0; offset < pixels.data.length; offset += 4) {
        const red = pixels.data[offset], green = pixels.data[offset + 1], blue = pixels.data[offset + 2];
        if (isCheckerboardPixel(red, green, blue)) pixels.data[offset + 3] = 0;
      }
      context.putImageData(pixels, 0, 0);
      this.textures.addSpriteSheet(`agent-${index}-clean`, canvas as unknown as HTMLImageElement, { frameWidth: 256, frameHeight: 256 });
    });
  }

  private createStationTextures() {
    const source = this.textures.get("office-modular").getSourceImage() as CanvasImageSource;
    [69, 70].forEach((frame, index) => {
      const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 256;
      const context = canvas.getContext("2d")!;
      context.drawImage(source, (frame % 22) * 128, Math.floor(frame / 22) * 256, 128, 256, 0, 0, 128, 256);
      const pixels = context.getImageData(0, 0, 128, 256);
      clearEdgeConnectedBackdrop(128, 256, pixels.data);
      context.putImageData(pixels, 0, 0);
      this.textures.addImage(index ? "station-chair" : "station-desk", canvas as unknown as HTMLImageElement);
    });
  }

  private createCharacterAnimations() {
    [1, 2, 3].forEach((index) => {
      const texture = `agent-${index}-clean`;
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
