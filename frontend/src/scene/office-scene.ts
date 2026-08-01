import Phaser from "phaser";
import type { Agent } from "../types";
import { GRID_HEIGHT, GRID_WIDTH, TILE_HEIGHT, TILE_WIDTH, gridToScreen, isInsideGrid, screenToGrid } from "./grid";
import { sceneEvents } from "./scene-events";
import { useSceneStore } from "../stores/scene-store";
import { cellKey, findNavigationPath, releaseAgentReservations, releaseReservation, reserveRoute, reservedByOthers } from "./pathfinding";
import type { SceneInteraction } from "./scene-events";
import { isCheckerboardPixel } from "./character-sheet";
import { clearEdgeConnectedBackdrop } from "./alpha-mask";
import { isValidStationCell } from "./station-layout";
import { IdleBehaviorController, type IdleBehaviorType } from "./idle-behavior-controller";
import { NavigationGrid } from "./maps/navigation-grid";
import { preservesNavigationRoutes } from "./maps/connectivity";
import { homeSeatForAgent, IDLE_POINTS, isInsideEmptyRoomFloor, MEETING_AREAS, STATIC_SEATS, staticObstacleKeys, WORKSTATION_CELLS, WORKSTATIONS, type SeatAnchor } from "./maps/office-layout";
import { SeatRegistry, sameGridPoint, seatApproachWorldPosition, seatedWorldPosition } from "./maps/seats";
import { FURNITURE_ASSETS, defaultFurnitureOrientation, duplicatedFurnitureInstances, furnitureAsset, furnitureCells, furnitureGroupCenter, furnitureImage, furnitureInteractionPoints, furnitureOrientations, furnitureOrigin, furnitureSeat, furnitureSeats, furnitureTextureKey, linkedFurnitureIds, movedFurnitureInstances, removableFurnitureIds, type AgentSeatAssignments, type FurnitureInstance, type FurnitureOrientation } from "./furniture/catalog";

type DrawnAgent = { body: Phaser.GameObjects.Container; station: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Sprite; status: Phaser.GameObjects.Arc; data: Agent; currentCell: Agent["position"]; seatId?: string; idleToken: number };
type FurnitureLayers = { rear: Phaser.GameObjects.Sprite; front?: Phaser.GameObjects.Sprite };
type PlacementState = "valid" | "collision" | "blocks_route";

export class OfficeScene extends Phaser.Scene {
  private agents = new Map<string, DrawnAgent>();
  private editMode = false;
  private draggingCamera = false;
  private lastPointer = new Phaser.Math.Vector2();
  private activeInteractions = new Set<string>();
  private routeReservations = new Map<string, string>();
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private stationPreview?: Phaser.GameObjects.Graphics;
  private selectionGraphics?: Phaser.GameObjects.Graphics;
  private stationDrag?: string;
  private furnitureDrag?: string;
  private placingFurnitureAssetId?: string;
  private placingFurnitureOrientation?: FurnitureOrientation;
  private placementCell?: Agent["position"];
  private furnitureGhost?: Phaser.GameObjects.Sprite;
  private readonly furnitureSprites = new Map<string, FurnitureLayers>();
  private furnitureBlocks = new Map<string, string>();
  private furnitureItems: FurnitureInstance[] = [];
  private agentSeatAssignments: AgentSeatAssignments = {};
  private selectedFurnitureIds = new Set<string>();
  private highlightedFurnitureIds = new Set<string>();
  private stationOrigin?: Agent["position"];
  private readonly navigation = new NavigationGrid();
  private readonly seats = new SeatRegistry();
  private readonly furnitureCells = staticObstacleKeys;
  private readonly idlePointOwners = new Map<string, string>();
  private readonly idleController = new IdleBehaviorController({ canRun: (id) => this.canRunIdle(id), execute: (id, behavior) => this.runIdleBehavior(id, behavior) });
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private debugText?: Phaser.GameObjects.Text;
  private debugLabels: Phaser.GameObjects.Text[] = [];
  private debugEnabled = false;
  private idleMeetingActive = false;

  constructor() { super("office"); }

  preload() {
    const assetPath = window.location.protocol === "file:" ? "./" : "/";
    this.load.image("office", `${assetPath}cenario_completo_vazio_sprite.png`);
    this.load.image("office-modular", `${assetPath}assets_cenario_2_modular.png`);
    FURNITURE_ASSETS.forEach((asset) => furnitureOrientations(asset).forEach((orientation) => this.load.image(furnitureTextureKey(asset, orientation), `${assetPath}${furnitureImage(asset, orientation)}`)));
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
    background.on("pointerdown", (pointer: Phaser.Input.Pointer) => { if (this.placingFurnitureAssetId) return; this.draggingCamera = true; this.lastPointer.set(pointer.x, pointer.y); });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.debugEnabled) this.updateDebugPointer(pointer);
      if (this.placingFurnitureAssetId) { this.previewNewFurniture(pointer); return; }
      if (this.stationDrag) { this.previewStation(this.stationDrag, pointer); return; }
      if (this.furnitureDrag) { this.previewFurniture(this.furnitureDrag, pointer); return; }
      if (!this.draggingCamera) return;
      this.cameras.main.scrollX -= (pointer.x - this.lastPointer.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (pointer.y - this.lastPointer.y) / this.cameras.main.zoom;
      this.lastPointer.set(pointer.x, pointer.y);
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.placingFurnitureAssetId) { this.placeNewFurniture(pointer); return; }
      if (this.stationDrag) { this.moveToCell(this.stationDrag, pointer); this.stationDrag = undefined; this.stationOrigin = undefined; this.stationPreview?.clear(); }
      if (this.furnitureDrag) { this.moveFurnitureToCell(this.furnitureDrag, pointer); this.furnitureDrag = undefined; this.stationPreview?.clear(); }
      this.draggingCamera = false;
    });
    sceneEvents.addEventListener("agents", this.sync as EventListener);
    sceneEvents.addEventListener("interaction", this.interact as EventListener);
    window.addEventListener("furniture:rotate-request", this.rotateFurnitureRequest as EventListener);
    window.addEventListener("furniture:duplicate-request", this.duplicateFurnitureRequest as EventListener);
    window.addEventListener("furniture:delete-request", this.deleteFurnitureRequest as EventListener);
    window.addEventListener("furniture:delete-force", this.deleteFurnitureForce as EventListener);
    window.addEventListener("furniture:focus-group", this.focusFurnitureGroup as EventListener);
    this.sync(new CustomEvent("agents", { detail: { agents: useSceneStore.getState().agents, editMode: useSceneStore.getState().editMode, furniture: useSceneStore.getState().furniture, agentSeatAssignments: useSceneStore.getState().agentSeatAssignments, selectedFurnitureIds: useSceneStore.getState().selectedFurnitureIds, highlightedFurnitureIds: useSceneStore.getState().selectedFurnitureIds, placingFurnitureAssetId: useSceneStore.getState().placingFurnitureAssetId, placingFurnitureOrientation: useSceneStore.getState().placingFurnitureOrientation } }));
    this.input.keyboard?.on("keydown-F", () => this.focusSelected());
    this.input.keyboard?.on("keydown-ESC", () => { if (this.placingFurnitureAssetId) window.dispatchEvent(new Event("furniture:cancel-placement")); else window.dispatchEvent(new Event("agent:deselect")); });
    (["LEFT", "RIGHT", "UP", "DOWN"] as const).forEach((key) => this.input.keyboard?.on(`keydown-${key}`, (event: KeyboardEvent) => this.nudgeFurniturePlacement({ LEFT: -1, RIGHT: 1, UP: 0, DOWN: 0 }[key], { LEFT: 0, RIGHT: 0, UP: -1, DOWN: 1 }[key], event.shiftKey ? 3 : 1)));
    if (import.meta.env.DEV) this.input.keyboard?.on("keydown-N", () => this.toggleNavigationDebug());
  }

  shutdown() { this.idleController.cancelAll(); sceneEvents.removeEventListener("agents", this.sync as EventListener); sceneEvents.removeEventListener("interaction", this.interact as EventListener); window.removeEventListener("furniture:rotate-request", this.rotateFurnitureRequest as EventListener); window.removeEventListener("furniture:duplicate-request", this.duplicateFurnitureRequest as EventListener); window.removeEventListener("furniture:delete-request", this.deleteFurnitureRequest as EventListener); window.removeEventListener("furniture:delete-force", this.deleteFurnitureForce as EventListener); window.removeEventListener("furniture:focus-group", this.focusFurnitureGroup as EventListener); }

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
    const { agents, editMode, furniture, agentSeatAssignments, selectedFurnitureIds, highlightedFurnitureIds = selectedFurnitureIds, placingFurnitureAssetId, placingFurnitureOrientation } = (event as CustomEvent<{ agents: Agent[]; editMode: boolean; furniture: FurnitureInstance[]; agentSeatAssignments: AgentSeatAssignments; selectedFurnitureIds: string[]; highlightedFurnitureIds?: string[]; placingFurnitureAssetId?: string; placingFurnitureOrientation?: FurnitureOrientation }>).detail;
    this.editMode = editMode;
    this.agentSeatAssignments = agentSeatAssignments;
    this.selectedFurnitureIds = new Set(selectedFurnitureIds);
    this.highlightedFurnitureIds = new Set(highlightedFurnitureIds);
    this.placingFurnitureAssetId = editMode ? placingFurnitureAssetId : undefined;
    this.placingFurnitureOrientation = editMode ? placingFurnitureOrientation : undefined;
    if (!this.placingFurnitureAssetId) { this.placementCell = undefined; this.furnitureGhost?.destroy(); this.furnitureGhost = undefined; this.stationPreview?.clear(); }
    else this.previewNewFurniture(this.input.activePointer);
    this.gridGraphics?.setVisible(editMode);
    if (!editMode) { this.stationDrag = undefined; this.stationOrigin = undefined; this.stationPreview?.clear(); }
    if (editMode) this.idleController.cancelAll();
    this.renderFurniture(furniture);
    const currentIds = new Set(agents.map((agent) => agent.id));
    this.agents.forEach((drawn, id) => {
      if (currentIds.has(id)) return;
      this.idleController.cancelBehavior(id);
      releaseAgentReservations(this.routeReservations, id);
      this.idlePointOwners.forEach((owner, pointId) => { if (owner === id) this.idlePointOwners.delete(pointId); });
      this.leaveSeatForWalking(drawn);
      drawn.body.destroy(); drawn.station.destroy(); this.agents.delete(id);
    });
    agents.forEach((agent) => this.drawAgent(agent));
    if (!editMode) agents.forEach((agent) => this.scheduleIdle(agent.id));
    this.renderNavigationDebug();
  };

  private drawAgent(agent: Agent) {
    const screen = gridToScreen(agent.position);
    let drawn = this.agents.get(agent.id);
    if (!drawn) {
      const shadow = this.add.ellipse(0, 5, 38, 12, 0x15202b, 0.28);
      const sprite = this.add.sprite(0, 0, this.textureFor(agent)).setOrigin(0.5, 0.9).setScale(0.52);
      const label = this.add.text(0, -138, agent.name, { fontFamily: "Inter, sans-serif", fontSize: "16px", color: "#f6f8fb", stroke: "#13202c", strokeThickness: 4 }).setOrigin(0.5);
      const status = this.add.circle(42, -108, 5, this.statusColor(agent.status));
      const container = this.add.container(screen.x, screen.y, [shadow, sprite, label, status]).setSize(96, 136).setInteractive({ useHandCursor: true });
      const station = this.createStationMarker(agent);
      container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        window.dispatchEvent(new CustomEvent("agent:select", { detail: agent.id }));
        if (this.editMode) { this.stationDrag = agent.id; this.stationOrigin = { ...agent.position }; this.previewStation(agent.id, pointer); }
      });
      container.on("pointerover", () => container.setScale(1.08));
      container.on("pointerout", () => container.setScale(1));
      drawn = { body: container, station, sprite, status, data: agent, currentCell: { ...agent.position }, idleToken: 0 };
      this.agents.set(agent.id, drawn);
    }
    drawn.data = agent;
    drawn.body.setDepth(screen.y);
    const homeSeat = this.modularHomeSeat(agent);
    drawn.station.setPosition(screen.x, screen.y).setDepth(screen.y - 1).setVisible(this.editMode && !homeSeat);
    drawn.status.setFillStyle(this.statusColor(agent.status));
    this.playVisualState(drawn.sprite, agent);
    if (homeSeat && this.isSeatVisualState(agent.status) && (drawn.seatId === homeSeat.id || (!drawn.seatId && sameGridPoint(drawn.currentCell, agent.position)))) this.attachAgentToSeat(drawn, homeSeat, agent.status === "working");
    else if (this.isSeatVisualState(agent.status) && !homeSeat) drawn.sprite.stop().setFrame(8);
    else if (!drawn.seatId) { drawn.currentCell = { ...agent.position }; this.tweens.add({ targets: drawn.body, x: screen.x, y: screen.y, duration: 240, ease: "Sine.out" }); }
  }

  private modularHomeSeat(agent: Agent, items = this.furnitureItems): SeatAnchor | undefined {
    const item = items.find((value) => value.id === this.agentSeatAssignments[agent.id]);
    const asset = item && furnitureAsset(item.assetId); const definition = asset && furnitureSeat(asset, item.orientation);
    if (!item || !definition) return undefined;
    return {
      id: `furniture-${item.id}-seat`, type: asset!.category === "sofa" ? "sofa_seat" : "office_chair",
      gridPosition: { x: item.position.x + definition.anchor.x, y: item.position.y + definition.anchor.y },
      approachPosition: { x: item.position.x + definition.approach.x, y: item.position.y + definition.approach.y },
      seatedSpriteOffset: definition.offset, facing: definition.facing, workstationId: item.id, ownerAgentId: agent.id, depthOffset: -2,
    };
  }

  private modularSofaSeats(): SeatAnchor[] {
    return this.furnitureItems.flatMap((item) => {
      const asset = furnitureAsset(item.assetId);
      if (!asset || asset.category !== "sofa") return [];
      return furnitureSeats(asset).map((seat, index) => ({
        id: `furniture-${item.id}-${seat.id ?? index}`, type: "sofa_seat" as const,
        gridPosition: { x: item.position.x + seat.anchor.x, y: item.position.y + seat.anchor.y },
        approachPosition: { x: item.position.x + seat.approach.x, y: item.position.y + seat.approach.y },
        seatedSpriteOffset: seat.offset, facing: seat.facing, workstationId: item.id, depthOffset: -2,
      }));
    });
  }

  private renderFurniture(items: FurnitureInstance[]) {
    this.furnitureItems = items;
    this.furnitureBlocks = furnitureCells(items);
    this.navigation.setFurniture(this.furnitureBlocks);
    const validPoints = new Set([...IDLE_POINTS.map((point) => point.id), ...furnitureInteractionPoints(items).map((point) => point.id)]);
    this.idlePointOwners.forEach((_agentId, pointId) => { if (!validPoints.has(pointId)) this.idlePointOwners.delete(pointId); });
    const ids = new Set(items.map((item) => item.id));
    this.furnitureSprites.forEach((layers, id) => { if (!ids.has(id)) { layers.rear.destroy(); layers.front?.destroy(); this.furnitureSprites.delete(id); } });
    items.forEach((item) => {
      const asset = furnitureAsset(item.assetId); if (!asset) return;
      const screen = this.furnitureScreenPosition(item), texture = furnitureTextureKey(asset, item.orientation); let layers = this.furnitureSprites.get(item.id);
      if (!layers) {
        const origin = furnitureOrigin(asset, item.orientation);
        const rear = this.add.sprite(screen.x, screen.y, texture).setOrigin(origin.x, origin.y).setScale(asset.defaultScale ?? 0.75);
        if (!item.parentId) rear.setInteractive({ useHandCursor: true }).on("pointerdown", (pointer: Phaser.Input.Pointer) => { pointer.event.stopPropagation(); if (this.editMode) { const source = pointer.event as MouseEvent; const additive = source.ctrlKey || source.metaKey || source.shiftKey; if (additive) { window.dispatchEvent(new CustomEvent("furniture:select", { detail: { id: item.id, additive: true } })); return; } this.furnitureDrag = item.id; if (!this.selectedFurnitureIds.has(item.id)) window.dispatchEvent(new CustomEvent("furniture:select", { detail: { id: item.id } })); } });
        const frontCropStart = asset.frontOcclusionStart;
        const front = frontCropStart === undefined ? undefined : this.add.sprite(screen.x, screen.y, texture).setOrigin(origin.x, origin.y).setScale(asset.defaultScale ?? 0.75);
        layers = { rear, front }; this.furnitureSprites.set(item.id, layers);
      } else if (layers.rear.texture.key !== texture) {
        layers.rear.setTexture(texture); layers.front?.setTexture(texture);
      }
      const origin = furnitureOrigin(asset, item.orientation);
      layers.rear.setOrigin(origin.x, origin.y); layers.front?.setOrigin(origin.x, origin.y);
      this.applyFurnitureLayerCrops(layers, asset, texture);
      const selected = this.selectedFurnitureIds.has(item.id), highlighted = this.highlightedFurnitureIds.has(item.id);
      layers.rear.clearTint().setPosition(screen.x, screen.y).setDepth(screen.y + (item.parentId ? 5 : layers.front ? -14 : -4)).setAlpha(this.editMode ? 1 : 0.96); if (selected) layers.rear.setTint(0xc6f2e7);
      else if (highlighted) layers.rear.setTint(0x9ed9cf);
      layers.front?.clearTint().setPosition(screen.x, screen.y).setDepth(screen.y + 10).setAlpha(this.editMode ? 1 : 0.96); if (selected) layers.front?.setTint(0xc6f2e7); else if (highlighted) layers.front?.setTint(0x9ed9cf);
    });
    this.renderSelectedFurnitureFootprints();
  }

  private renderSelectedFurnitureFootprints() {
    if (!this.selectionGraphics) this.selectionGraphics = this.add.graphics().setDepth(99_995);
    const graphics = this.selectionGraphics.clear().setVisible(this.editMode && this.highlightedFurnitureIds.size > 0);
    if (!this.editMode || !this.highlightedFurnitureIds.size) return;
    graphics.fillStyle(0x4cae9b, 0.14).lineStyle(2, 0x75c8b7, 0.92);
    this.furnitureItems.filter((item) => this.highlightedFurnitureIds.has(item.id)).forEach((item) => furnitureAsset(item.assetId)?.footprint.forEach((offset) => {
      const point = gridToScreen({ x: item.position.x + offset.x, y: item.position.y + offset.y });
      const diamond = [new Phaser.Geom.Point(point.x, point.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(point.x + TILE_WIDTH / 2, point.y), new Phaser.Geom.Point(point.x, point.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(point.x - TILE_WIDTH / 2, point.y), new Phaser.Geom.Point(point.x, point.y - TILE_HEIGHT / 2)];
      graphics.fillPoints(diamond, true).strokePoints(diamond);
    }));
  }

  private applyFurnitureLayerCrops(layers: FurnitureLayers, asset: ReturnType<typeof furnitureAsset>, texture: string) {
    if (!layers.front || !asset?.frontOcclusionStart) { layers.rear.setCrop(); return; }
    const image = this.textures.get(texture).getSourceImage() as { width: number; height: number };
    const start = Math.round(image.height * asset.frontOcclusionStart);
    layers.rear.setCrop(0, 0, image.width, start);
    layers.front.setCrop(0, start, image.width, image.height - start);
  }

  private previewFurniture(id: string, pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); const cell = screenToGrid(point.x, point.y); const screen = gridToScreen(cell);
    const pivot = this.furnitureItems.find((item) => item.id === id); if (!pivot) return;
    const delta = { x: cell.x - pivot.position.x, y: cell.y - pivot.position.y };
    const state = this.furnitureMoveState(id, cell);
    const tint = state === "valid" ? undefined : state === "blocks_route" ? 0xf0c52e : 0xffaaa4;
    this.movingFurniture(id).forEach((item) => {
      const layers = this.furnitureSprites.get(item.id); const position = this.furnitureScreenPosition(item, delta);
      if (layers) { layers.rear.setPosition(position.x, position.y).setAlpha(0.58); layers.front?.setPosition(position.x, position.y).setAlpha(0.58); if (tint) { layers.rear.setTint(tint); layers.front?.setTint(tint); } else { layers.rear.clearTint(); layers.front?.clearTint(); } }
    });
  }
  private previewNewFurniture(pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.placementCell = screenToGrid(point.x, point.y);
    this.previewNewFurnitureAt(this.placementCell);
  }
  private previewNewFurnitureAt(cell: Agent["position"]) {
    const asset = this.placingFurnitureAssetId && furnitureAsset(this.placingFurnitureAssetId);
    if (!asset) return;
    const orientation = this.placingFurnitureOrientation ?? defaultFurnitureOrientation(asset.id);
    const screen = gridToScreen(cell);
    if (!this.furnitureGhost) this.furnitureGhost = this.add.sprite(screen.x, screen.y, furnitureTextureKey(asset, orientation)).setOrigin(furnitureOrigin(asset, orientation).x, furnitureOrigin(asset, orientation).y).setScale(asset.defaultScale ?? 0.75).setDepth(99_997);
    const state = this.newFurniturePlacementState(asset.id, cell);
    const color = state === "valid" ? 0x9de2d2 : state === "blocks_route" ? 0xf0c52e : 0xffaaa4;
    this.furnitureGhost.setTexture(furnitureTextureKey(asset, orientation)).setOrigin(furnitureOrigin(asset, orientation).x, furnitureOrigin(asset, orientation).y).setPosition(screen.x, screen.y).setAlpha(state === "valid" ? 0.58 : 0.38).setTint(color);
    if (!this.stationPreview) this.stationPreview = this.add.graphics().setDepth(99_996);
    this.stationPreview.clear().fillStyle(state === "valid" ? 0x4cae9b : state === "blocks_route" ? 0xd89a34 : 0xd35c5c, 0.32);
    asset.footprint.forEach((offset) => { const tile = gridToScreen({ x: cell.x + offset.x, y: cell.y + offset.y }); this.stationPreview!.fillPoints([new Phaser.Geom.Point(tile.x, tile.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(tile.x + TILE_WIDTH / 2, tile.y), new Phaser.Geom.Point(tile.x, tile.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(tile.x - TILE_WIDTH / 2, tile.y)], true); });
  }
  private nudgeFurniturePlacement(x: number, y: number, distance: number) {
    if (!this.placingFurnitureAssetId) return;
    const world = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
    const point = this.placementCell ?? screenToGrid(world.x, world.y);
    this.placementCell = { x: point.x + x * distance, y: point.y + y * distance };
    this.previewNewFurnitureAt(this.placementCell);
  }
  private newFurniturePlacementState(assetId: string, position: Agent["position"]): PlacementState {
    const asset = furnitureAsset(assetId); if (!asset) return "collision";
    const occupied = furnitureCells(this.furnitureItems);
    const isPhysicalPlacementValid = asset.footprint.every((offset) => {
      const cell = { x: position.x + offset.x, y: position.y + offset.y };
      return isInsideEmptyRoomFloor(cell) && !occupied.has(`${cell.x},${cell.y}`) && ![...this.agents.values()].some((agent) => sameGridPoint(agent.currentCell, cell));
    });
    if (!isPhysicalPlacementValid) return "collision";
    const temporaryFurniture = new Map(this.furnitureBlocks);
    asset.footprint.forEach((offset) => temporaryFurniture.set(`${position.x + offset.x},${position.y + offset.y}`, `preview-${assetId}`));
    const previewNavigation = new NavigationGrid(); previewNavigation.setFurniture(temporaryFurniture);
    return preservesNavigationRoutes(previewNavigation, [...this.agents.values()].map((agent) => ({ agentId: agent.data.id, start: agent.currentCell, destination: this.homeSeat(agent.data).approachPosition }))) ? "valid" : "blocks_route";
  }
  private placeNewFurniture(pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); const cell = this.placementCell ?? screenToGrid(point.x, point.y);
    const state = this.placingFurnitureAssetId && this.newFurniturePlacementState(this.placingFurnitureAssetId, cell);
    if (state === "blocks_route") { window.dispatchEvent(new Event("furniture:route-blocked")); return; }
    if (state !== "valid") { window.dispatchEvent(new Event("furniture:invalid")); return; }
    window.dispatchEvent(new CustomEvent("furniture:place", { detail: cell }));
  }
  private moveFurnitureToCell(id: string, pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); const cell = screenToGrid(point.x, point.y);
    if (!isInsideGrid(cell)) return;
    const state = this.furnitureMoveState(id, cell);
    if (state !== "valid") { this.renderFurniture(this.furnitureItems); window.dispatchEvent(new Event(state === "blocks_route" ? "furniture:route-blocked" : "furniture:invalid")); return; }
    window.dispatchEvent(new CustomEvent("furniture:move", { detail: { id, position: cell } }));
  }

  private movingFurniture(id: string) {
    const ids = this.movingFurnitureIds(id);
    return this.furnitureItems.filter((item) => ids.has(item.id));
  }

  private movingFurnitureIds(id: string) {
    return this.selectedFurnitureIds.has(id) ? new Set([...this.selectedFurnitureIds].flatMap((selectedId) => [...linkedFurnitureIds(this.furnitureItems, selectedId)])) : linkedFurnitureIds(this.furnitureItems, id);
  }

  private furnitureMoveState(id: string, position: Agent["position"]): PlacementState {
    const movingIds = this.movingFurnitureIds(id);
    const candidate = movedFurnitureInstances(this.furnitureItems, id, position, movingIds); if (!candidate) return "collision";
    const occupied = furnitureCells(this.furnitureItems.filter((item) => !movingIds.has(item.id)));
    const cells = candidate.filter((item) => movingIds.has(item.id)).flatMap((item) => furnitureAsset(item.assetId)!.footprint.map((offset) => ({ x: item.position.x + offset.x, y: item.position.y + offset.y })));
    if (!cells.every(isInsideEmptyRoomFloor) || cells.some((cell) => occupied.has(`${cell.x},${cell.y}`)) || cells.some((cell, index) => cells.findIndex((other) => sameGridPoint(other, cell)) !== index) || cells.some((cell) => [...this.agents.values()].some((agent) => sameGridPoint(agent.currentCell, cell)))) return "collision";
    return this.preservesFurnitureRoutes(candidate) ? "valid" : "blocks_route";
  }

  private preservesFurnitureRoutes(items: FurnitureInstance[]) {
    const navigation = new NavigationGrid(); navigation.setFurniture(furnitureCells(items));
    return preservesNavigationRoutes(navigation, [...this.agents.values()].map((agent) => ({ agentId: agent.data.id, start: agent.currentCell, destination: this.homeSeat(agent.data, items).approachPosition })));
  }

  private rotateFurnitureRequest = (event: Event) => {
    const id = (event as CustomEvent<string>).detail; const item = this.furnitureItems.find((value) => value.id === id); const asset = item && furnitureAsset(item.assetId);
    if (!item || !asset) return;
    const orientations = furnitureOrientations(asset); if (orientations.length < 2) return;
    const orientation = orientations[(orientations.indexOf(item.orientation) + 1) % orientations.length];
    const candidate = this.furnitureItems.map((value) => value.id === id ? { ...value, orientation } : value);
    if (!this.preservesFurnitureRoutes(candidate)) { window.dispatchEvent(new Event("furniture:route-blocked")); return; }
    window.dispatchEvent(new CustomEvent("furniture:rotate", { detail: id }));
  };

  private duplicateFurnitureRequest = (event: Event) => {
    const id = (event as CustomEvent<string>).detail; const item = this.furnitureItems.find((value) => value.id === id); if (!item) return;
    const position = { x: item.position.x + 2, y: item.position.y + 2 };
    const duplicate = duplicatedFurnitureInstances(this.furnitureItems, useSceneStore.getState().furnitureGroups, id, position); if (!duplicate) return;
    const cells = furnitureCells(duplicate.furniture);
    if ([...cells.keys()].some((cell) => this.furnitureBlocks.has(cell)) || duplicate.furniture.some((value) => furnitureAsset(value.assetId)!.footprint.some((offset) => !isInsideEmptyRoomFloor({ x: value.position.x + offset.x, y: value.position.y + offset.y }))) || [...cells.keys()].some((cell) => [...this.agents.values()].some((agent) => cell === `${agent.currentCell.x},${agent.currentCell.y}`))) { window.dispatchEvent(new Event("furniture:invalid")); return; }
    if (!this.preservesFurnitureRoutes([...this.furnitureItems, ...duplicate.furniture])) { window.dispatchEvent(new Event("furniture:route-blocked")); return; }
    window.dispatchEvent(new CustomEvent("furniture:duplicate", { detail: { id, position } }));
  };

  private affectedAgentsForFurniture(ids: Set<string>) {
    const cells = furnitureCells(this.furnitureItems.filter((item) => ids.has(item.id)));
    return [...this.agents.values()].filter((agent) => ids.has(this.agentSeatAssignments[agent.data.id] ?? "") || [...ids].some((itemId) => agent.seatId === `furniture-${itemId}-seat` || agent.seatId?.startsWith(`furniture-${itemId}-`)) || cells.has(`${agent.currentCell.x},${agent.currentCell.y}`));
  }

  private deleteFurnitureRequest = (event: Event) => {
    const id = (event as CustomEvent<string>).detail; const ids = removableFurnitureIds(this.furnitureItems, id); if (!ids.size) return;
    const affected = this.affectedAgentsForFurniture(ids);
    if (affected.length) { window.dispatchEvent(new CustomEvent("furniture:delete-confirmation", { detail: { id, agentNames: affected.map((agent) => agent.data.name) } })); return; }
    window.dispatchEvent(new CustomEvent("furniture:delete", { detail: id }));
  };

  private deleteFurnitureForce = (event: Event) => {
    const id = (event as CustomEvent<string>).detail; const ids = removableFurnitureIds(this.furnitureItems, id);
    this.affectedAgentsForFurniture(ids).forEach((agent) => { this.idleController.cancelBehavior(agent.data.id); this.leaveSeatForWalking(agent); });
    window.dispatchEvent(new CustomEvent("furniture:delete", { detail: id }));
  };

  private focusFurnitureGroup = (event: Event) => {
    const center = furnitureGroupCenter(this.furnitureItems, (event as CustomEvent<string[]>).detail);
    if (!center) return;
    const point = gridToScreen(center);
    this.cameras.main.pan(point.x, point.y, 250, "Sine.easeInOut");
  };

  private furnitureScreenPosition(item: FurnitureInstance, delta = { x: 0, y: 0 }) {
    const host = item.parentId ? this.furnitureItems.find((candidate) => candidate.id === item.parentId) : undefined;
    const position = host ?? item;
    const screen = gridToScreen({ x: position.position.x + delta.x, y: position.position.y + delta.y });
    return { x: screen.x + (item.surfaceOffset?.x ?? 0), y: screen.y + (item.surfaceOffset?.y ?? 0) };
  }

  private moveToCell(id: string, pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = screenToGrid(point.x, point.y);
    if (!this.isStationCellValid(id, cell)) {
      const origin = this.stationOrigin;
      if (origin) this.agents.get(id)?.station.setPosition(gridToScreen(origin).x, gridToScreen(origin).y).setAlpha(1);
      window.dispatchEvent(new CustomEvent("station:invalid", { detail: cell })); return;
    }
    this.agents.get(id)?.station.setAlpha(1);
    window.dispatchEvent(new CustomEvent("agent:move", { detail: { id, ...cell } }));
  }

  private createStationMarker(agent: Agent) {
    const point = gridToScreen(agent.position);
    const desk = this.add.sprite(-14, 4, "station-desk").setOrigin(0.5, 0.82).setScale(0.35);
    const chair = this.add.sprite(18, 10, "station-chair").setOrigin(0.5, 0.82).setScale(0.35);
    const monitor = this.add.graphics().fillStyle(0x1c2a31, 1).fillRoundedRect(-15, -22, 15, 11, 2).fillStyle(0x8ed8e5, 1).fillRect(-13, -20, 11, 7).fillStyle(0x11191e, 1).fillRect(-9, -11, 3, 5).fillRect(-12, -7, 9, 2);
    const label = this.add.text(0, -47, `ESTAÇÃO ${agent.name.toUpperCase()}`, { fontFamily: "Inter, sans-serif", fontSize: "10px", color: "#d8f5ef", stroke: "#13202c", strokeThickness: 3 }).setOrigin(0.5);
    const interactionPoints = [[0, -TILE_HEIGHT / 2], [TILE_WIDTH / 2, 0], [-TILE_WIDTH / 2, 0]].map(([x, y]) => this.add.circle(x, y, 4, 0x4cae9b, 0.78));
    return this.add.container(point.x, point.y, [desk, chair, monitor, label, ...interactionPoints]).setVisible(false);
  }

  private previewStation(agentId: string, pointer: Phaser.Input.Pointer) {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = screenToGrid(point.x, point.y);
    const screen = gridToScreen(cell);
    if (!this.stationPreview) this.stationPreview = this.add.graphics().setDepth(9999);
    const valid = this.isStationCellValid(agentId, cell);
    this.agents.get(agentId)?.station.setPosition(screen.x, screen.y).setAlpha(valid ? 0.72 : 0.42);
    this.stationPreview.clear().fillStyle(valid ? 0x4cae9b : 0xd35c5c, 0.38).lineStyle(2, valid ? 0x9de2d2 : 0xffaaa4, 0.9).fillPoints([
      new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(screen.x + TILE_WIDTH / 2, screen.y), new Phaser.Geom.Point(screen.x, screen.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(screen.x - TILE_WIDTH / 2, screen.y),
    ], true).strokePoints([
      new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(screen.x + TILE_WIDTH / 2, screen.y), new Phaser.Geom.Point(screen.x, screen.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(screen.x - TILE_WIDTH / 2, screen.y), new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT / 2),
    ]);
  }

  private isStationCellValid(agentId: string, cell: Agent["position"]) {
    const anchor = WORKSTATIONS.find((item) => sameGridPoint(item.gridPosition, cell));
    if (!anchor) return false;
    return this.navigation.canEnter(anchor.approachPosition, agentId) && isValidStationCell(cell, agentId, [...this.agents.values()].map(({ data }) => data), this.furnitureCells);
  }

  private homeSeat(agent: Agent, items = this.furnitureItems): SeatAnchor { return this.modularHomeSeat(agent, items) ?? homeSeatForAgent(agent); }
  private isSeatVisualState(status: Agent["status"]) { return ["idle", "seated", "working", "waiting_approval", "completed"].includes(status); }
  private attachAgentToSeat(agent: DrawnAgent, seat: SeatAnchor, typing = false) {
    if (!this.seats.occupy(seat, agent.data.id)) return false;
    const world = seatedWorldPosition(seat); agent.body.setPosition(world.x, world.y).setDepth(world.y); agent.currentCell = { ...seat.gridPosition }; agent.seatId = seat.id;
    if (typing) agent.sprite.play(`${this.textureFor(agent.data)}-typing-${seat.facing}`, true);
    else agent.sprite.stop().setFrame(this.seatedFrame(seat.facing));
    return true;
  }
  private detachAgentFromSeat(agent: DrawnAgent, seat: SeatAnchor) {
    this.seats.release(seat, agent.data.id); const world = seatApproachWorldPosition(seat);
    agent.body.setPosition(world.x, world.y).setDepth(world.y); agent.currentCell = { ...seat.approachPosition }; agent.seatId = undefined; agent.sprite.stop().setFrame(8);
  }
  private leaveSeatForWalking(agent: DrawnAgent) {
    if (!agent.seatId) return;
    const modularSeat = this.modularHomeSeat(agent.data);
    const seat = agent.seatId === modularSeat?.id ? modularSeat : [...STATIC_SEATS, ...this.modularSofaSeats()].find((item) => item.id === agent.seatId);
    if (seat) this.detachAgentFromSeat(agent, seat);
  }
  private async returnToWorkstation(agent: DrawnAgent, token?: number) {
    const seat = this.modularHomeSeat(agent.data); if (!seat || !this.seats.reserve(seat, agent.data.id)) return false;
    const route = this.planRoute(agent.data.id, agent.currentCell, seat.approachPosition); if (!route) { this.seats.release(seat, agent.data.id); return false; }
    if (!await this.walk(agent, route, token)) { this.seats.release(seat, agent.data.id); return false; }
    if (token !== undefined && token !== agent.idleToken) { this.seats.release(seat, agent.data.id); return false; }
    const attached = this.attachAgentToSeat(agent, seat, agent.data.status === "working");
    if (!attached) this.seats.release(seat, agent.data.id);
    return attached;
  }

  private interact = (event: Event) => { void this.runInteraction((event as CustomEvent<SceneInteraction>).detail); };

  private async runInteraction(interaction: SceneInteraction) {
    if (this.activeInteractions.has(interaction.interactionId)) return;
    const source = this.agents.get(interaction.sourceAgentId);
    const target = this.agents.get(interaction.targetAgentId);
    if (!source || !target || this.activeInteractions.has(source.data.id) || this.activeInteractions.has(target.data.id)) return;
    this.idleController.cancelBehavior(source.data.id); this.idleController.cancelBehavior(target.data.id); this.leaveSeatForWalking(source);
    const blocked = this.blockedCellsFor(source.data.id);
    const destination = [{ x: target.currentCell.x, y: target.currentCell.y + 1 }, { x: target.currentCell.x + 1, y: target.currentCell.y }, { x: target.currentCell.x - 1, y: target.currentCell.y }, { x: target.currentCell.x, y: target.currentCell.y - 1 }].find((cell) => isInsideGrid(cell) && this.navigation.canEnter(cell, source.data.id, blocked));
    if (!destination) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
    const route = this.planRoute(source.data.id, source.currentCell, destination);
    if (!route) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
    this.activeInteractions.add(interaction.interactionId); this.activeInteractions.add(source.data.id); this.activeInteractions.add(target.data.id);
    window.dispatchEvent(new CustomEvent("interaction:started", { detail: interaction }));
    try {
      if (!await this.walk(source, route)) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
      target.sprite.stop().setFrame(8);
      const bubble = this.add.text(target.body.x, target.body.y - 138, interaction.summary, { fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#18252c", backgroundColor: "#f5fbfd", wordWrap: { width: 260 }, padding: { x: 10, y: 7 } }).setOrigin(0.5).setDepth(99999);
      await this.wait(1600);
      bubble.destroy();
      if (!await this.returnToWorkstation(source)) { window.dispatchEvent(new CustomEvent("interaction:failed", { detail: interaction })); return; }
      this.playVisualState(source.sprite, { ...source.data, status: "working" });
      window.dispatchEvent(new CustomEvent("interaction:completed", { detail: interaction }));
    } finally {
      releaseAgentReservations(this.routeReservations, source.data.id);
      this.activeInteractions.delete(interaction.interactionId); this.activeInteractions.delete(source.data.id); this.activeInteractions.delete(target.data.id);
    }
  }

  private async walk(agent: DrawnAgent, route: Agent["position"][], token?: number): Promise<boolean> {
    const destination = route.at(-1)!; let activeRoute = route; let index = 1; let repaths = 0;
    while (index < activeRoute.length) {
      if (token !== undefined && token !== agent.idleToken) return false;
      const previous = activeRoute[index - 1], next = activeRoute[index];
      const blocked = this.blockedCellsFor(agent.data.id);
      if (!this.navigation.canEnter(next, agent.data.id, blocked) || !reserveRoute(this.routeReservations, agent.data.id, activeRoute.slice(index - 1, index + 2))) {
        if (repaths++ >= 3) return false;
        releaseAgentReservations(this.routeReservations, agent.data.id);
        const replanned = this.planRoute(agent.data.id, agent.currentCell, destination);
        if (!replanned) return false;
        activeRoute = replanned; index = 1; continue;
      }
      agent.sprite.play(`${this.textureFor(agent.data)}-walk-${next.x > previous.x ? "east" : next.x < previous.x ? "west" : next.y > previous.y ? "south" : "north"}`, true);
      const screen = gridToScreen(next);
      await new Promise<void>((resolve) => this.tweens.add({ targets: agent.body, x: screen.x, y: screen.y, duration: 180, ease: "Sine.out", onComplete: () => resolve() }));
      agent.currentCell = { ...next };
      releaseReservation(this.routeReservations, agent.data.id, previous);
      index += 1;
    }
    agent.sprite.stop();
    releaseReservation(this.routeReservations, agent.data.id, agent.currentCell);
    return true;
  }

  private blockedCellsFor(agentId: string) {
    const blocked = new Set<string>();
    this.furnitureBlocks.forEach((_furnitureId, cell) => blocked.add(cell));
    this.agents.forEach(({ currentCell }, id) => { if (id !== agentId) blocked.add(cellKey(currentCell)); });
    reservedByOthers(this.routeReservations, agentId).forEach((cell) => blocked.add(cell));
    return blocked;
  }

  private planRoute(agentId: string, start: Agent["position"], goal: Agent["position"]) {
    // ponytail: two attempts cover synchronous contention; queue routes if traffic grows.
    for (let attempt = 0; attempt < 2; attempt++) {
      const route = findNavigationPath(start, goal, this.navigation, agentId, this.blockedCellsFor(agentId));
      if (!route) return null;
      if (reserveRoute(this.routeReservations, agentId, route)) return route;
    }
    return null;
  }

  private wait(milliseconds: number) { return new Promise<void>((resolve) => this.time.delayedCall(milliseconds, resolve)); }

  private scheduleIdle(agentId: string) {
    if (this.canRunIdle(agentId)) { this.idleController.scheduleNextBehavior(agentId); return; }
    this.idleController.cancelBehavior(agentId);
    const agent = this.agents.get(agentId);
    if (agent && ["queued", "working", "waiting_approval"].includes(agent.data.status)) this.interruptIdleForWork(agent);
  }
  private interruptIdleForWork(agent: DrawnAgent) {
    const home = this.homeSeat(agent.data);
    if (agent.seatId === home.id || this.activeInteractions.has(agent.data.id)) return;
    agent.idleToken += 1;
    this.idlePointOwners.forEach((owner, id) => { if (owner === agent.data.id) this.idlePointOwners.delete(id); });
    this.leaveSeatForWalking(agent);
    void this.returnToWorkstation(agent);
  }
  private canRunIdle(agentId: string) {
    const agent = this.agents.get(agentId); if (!agent || this.editMode || this.stationDrag || this.activeInteractions.has(agentId)) return false;
    const allowed = ["idle", "seated", "completed"]; const away = [...this.agents.values()].filter((item) => item.seatId === undefined).length;
    return Boolean(this.modularHomeSeat(agent.data)) && allowed.includes(agent.data.status) && away < Math.max(1, Math.floor(this.agents.size * 0.4));
  }
  private reserveIdlePoint(agentId: string) {
    const point = [...IDLE_POINTS, ...furnitureInteractionPoints(this.furnitureItems)].find((item) => !this.idlePointOwners.has(item.id) && this.navigation.canEnter(item.gridPosition, agentId, this.blockedCellsFor(agentId)));
    if (point) this.idlePointOwners.set(point.id, agentId);
    return point;
  }
  private async runIdleBehavior(agentId: string, behavior: IdleBehaviorType) {
    const agent = this.agents.get(agentId); if (!agent || !this.canRunIdle(agentId)) return; const token = ++agent.idleToken;
    if (behavior === "remain_seated") { await this.wait(1200); return; }
    const homeFacing = this.homeSeat(agent.data).facing;
    if (behavior === "typing") { agent.sprite.play(`${this.textureFor(agent.data)}-typing-${homeFacing}`, true); await this.wait(2200); if (token === agent.idleToken) agent.sprite.stop().setFrame(this.seatedFrame(homeFacing)); return; }
    if (behavior === "look_around") { agent.sprite.stop().setFrame(this.seatedFrame(homeFacing)); await this.wait(1400); return; }
    if (behavior === "join_idle_meeting") { await this.runIdleMeeting(agent, token); return; }
    const targetSeat = behavior === "sit_on_sofa" ? [...this.modularSofaSeats(), ...STATIC_SEATS].find((seat) => seat.type === "sofa_seat" && this.seats.reserve(seat, agentId)) : undefined;
    const targetPoint = targetSeat ? targetSeat.approachPosition : this.reserveIdlePoint(agentId)?.gridPosition;
    if (!targetPoint) return;
    this.leaveSeatForWalking(agent); const route = this.planRoute(agentId, agent.currentCell, targetPoint); if (!route) { if (targetSeat) this.seats.release(targetSeat, agentId); this.idlePointOwners.forEach((owner, id) => { if (owner === agentId) this.idlePointOwners.delete(id); }); return; }
    if (!await this.walk(agent, route, token) || token !== agent.idleToken) {
      if (targetSeat) this.seats.release(targetSeat, agentId);
      this.idlePointOwners.forEach((owner, id) => { if (owner === agentId) this.idlePointOwners.delete(id); });
      return;
    }
    if (targetSeat) this.attachAgentToSeat(agent, targetSeat);
    await this.wait(behavior === "short_walk" ? 900 : 2600);
    if (targetSeat) this.detachAgentFromSeat(agent, targetSeat);
    if (targetPoint) this.idlePointOwners.forEach((owner, id) => { if (owner === agentId) this.idlePointOwners.delete(id); });
    if (token === agent.idleToken) await this.returnToWorkstation(agent, token);
  }
  private async runIdleMeeting(host: DrawnAgent, token: number) {
    if (this.idleMeetingActive) return; const peer = [...this.agents.values()].find((agent) => agent.data.id !== host.data.id && this.canRunIdle(agent.data.id)); const seats = MEETING_AREAS[0].seatIds.map((id) => STATIC_SEATS.find((seat) => seat.id === id)!).filter((seat) => !this.seats.occupiedBy(seat.id));
    if (!peer || seats.length < 2 || !this.seats.reserve(seats[0], host.data.id) || !this.seats.reserve(seats[1], peer.data.id)) { this.seats.release(seats[0], host.data.id); return; }
    this.idleMeetingActive = true; this.idleController.cancelBehavior(peer.data.id); this.leaveSeatForWalking(host); this.leaveSeatForWalking(peer);
    try {
      const hostRoute = this.planRoute(host.data.id, host.currentCell, seats[0].approachPosition), peerRoute = this.planRoute(peer.data.id, peer.currentCell, seats[1].approachPosition);
      if (!hostRoute || !peerRoute) return;
      const [hostArrived, peerArrived] = await Promise.all([this.walk(host, hostRoute, token), this.walk(peer, peerRoute, ++peer.idleToken)]); if (!hostArrived || !peerArrived || token !== host.idleToken) return;
      this.attachAgentToSeat(host, seats[0]); this.attachAgentToSeat(peer, seats[1]);
      const bubble = this.add.text((host.body.x + peer.body.x) / 2, Math.min(host.body.y, peer.body.y) - 100, "Alinhamento rápido", { fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#18252c", backgroundColor: "#f5fbfd", padding: { x: 8, y: 5 } }).setOrigin(0.5).setDepth(99999);
      await this.wait(2600); bubble.destroy(); this.detachAgentFromSeat(host, seats[0]); this.detachAgentFromSeat(peer, seats[1]); await Promise.all([this.returnToWorkstation(host, token), this.returnToWorkstation(peer)]);
    } finally { this.idleMeetingActive = false; this.seats.release(seats[0], host.data.id); this.seats.release(seats[1], peer.data.id); }
  }

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
      (["north", "south", "east", "west"] as const).forEach((direction, row) => this.anims.create({ key: `${texture}-typing-${direction}`, frames: this.anims.generateFrameNumbers(texture, { start: 34 + row * 8, end: 39 + row * 8 }), frameRate: 5, repeat: -1 }));
    });
  }

  private playVisualState(sprite: Phaser.GameObjects.Sprite, agent: Agent) {
    const texture = this.textureFor(agent);
    if (agent.status === "walking" || agent.status === "returning") sprite.play(`${texture}-walk-${agent.direction}`, true);
    else if (agent.status === "working") sprite.play(`${texture}-typing-${agent.direction}`, true);
    else { sprite.stop(); sprite.setFrame(this.isSeatVisualState(agent.status) ? this.seatedFrame(agent.direction) : 8); }
  }

  private seatedFrame(direction: Agent["direction"]) { return { north: 32, south: 40, east: 48, west: 56 }[direction]; }

  private focusSelected() {
    const selected = [...this.agents.values()].find(({ data }) => data.id === (window as Window & { selectedAgentId?: string }).selectedAgentId);
    if (selected) this.cameras.main.pan(selected.body.x, selected.body.y, 250, "Sine.easeInOut");
  }

  private toggleNavigationDebug() { this.debugEnabled = !this.debugEnabled; this.renderNavigationDebug(); }
  private renderNavigationDebug() {
    if (!import.meta.env.DEV) return;
    if (!this.debugGraphics) this.debugGraphics = this.add.graphics().setDepth(99_998);
    if (!this.debugText) this.debugText = this.add.text(8, 8, "", { fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#e8f8fb", backgroundColor: "#142028", padding: { x: 6, y: 4 } }).setScrollFactor(0).setDepth(100_000);
    this.debugGraphics.clear().setVisible(this.debugEnabled); this.debugText.setVisible(this.debugEnabled);
    this.debugLabels.forEach((label) => label.destroy()); this.debugLabels = [];
    if (!this.debugEnabled) return;
    const colors = { corridor: 0x36d47b, walkable: 0x36d47b, work_area: 0x36d47b, meeting_area: 0x4c9eea, rest_area: 0x4c9eea, blocked: 0xdf4f4f, seat: 0xb65ee8, interaction_point: 0xe89526 };
    this.navigation.allCells().forEach((cell) => { const point = gridToScreen({ x: cell.gridX, y: cell.gridY }); const color = colors[cell.type]; this.debugGraphics!.fillStyle(color, cell.walkable ? 0.13 : 0.23).fillPoints([new Phaser.Geom.Point(point.x, point.y - TILE_HEIGHT / 2), new Phaser.Geom.Point(point.x + TILE_WIDTH / 2, point.y), new Phaser.Geom.Point(point.x, point.y + TILE_HEIGHT / 2), new Phaser.Geom.Point(point.x - TILE_WIDTH / 2, point.y)], true); });
    [...WORKSTATIONS, ...STATIC_SEATS, ...this.modularSofaSeats()].forEach((seat) => {
      const anchor = gridToScreen(seat.gridPosition); const approach = gridToScreen(seat.approachPosition);
      const vector = { north: { x: 0, y: -12 }, south: { x: 0, y: 12 }, east: { x: 14, y: 0 }, west: { x: -14, y: 0 } }[seat.facing];
      this.debugGraphics!.fillStyle(0xb65ee8, 1).fillCircle(anchor.x, anchor.y, 6).fillStyle(0x38dbe5, 1).fillCircle(approach.x, approach.y, 5).lineStyle(2, 0xf0c52e, 1).lineBetween(anchor.x, anchor.y, anchor.x + vector.x, anchor.y + vector.y);
      this.debugLabels.push(this.add.text(anchor.x + 8, anchor.y - 8, seat.id, { fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: "#ffffff", stroke: "#142028", strokeThickness: 3 }).setDepth(100_000));
    });
    [...IDLE_POINTS, ...furnitureInteractionPoints(this.furnitureItems)].forEach((point) => { const world = gridToScreen(point.gridPosition); this.debugGraphics!.fillStyle(0xe89526, 1).fillCircle(world.x, world.y, 5); this.debugLabels.push(this.add.text(world.x + 7, world.y + 3, point.id, { fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: "#ffffff", stroke: "#142028", strokeThickness: 3 }).setDepth(100_000)); });
    this.agents.forEach((agent) => {
      const seat = this.homeSeat(agent.data); const point = gridToScreen(seat.approachPosition);
      this.debugGraphics!.fillStyle(0x6ee9ef, 0.9).fillCircle(point.x, point.y, 4).lineStyle(1, 0xffffff, 0.75).strokeRect(agent.body.x - 18, agent.body.y - 34, 36, 38);
    });
    this.debugText.setText(`N debug · verde corredor · vermelho bloqueado · roxo assento · ciano aproximação\n${[...this.agents.values()].map((agent) => `${agent.data.id}: ${agent.currentCell.x},${agent.currentCell.y} pés ${Math.round(agent.body.x)},${Math.round(agent.body.y)}`).join(" · ")}`);
  }
  private updateDebugPointer(pointer: Phaser.Input.Pointer) {
    if (!this.debugText) return; const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y); const grid = screenToGrid(world.x, world.y);
    this.debugText.setText(`N debug · grid ${grid.x},${grid.y} · screen ${Math.round(world.x)},${Math.round(world.y)}\nverde corredor · vermelho bloqueado · roxo assento · ciano aproximação`);
  }

  private statusColor(status: Agent["status"]) {
    const colors: Partial<Record<Agent["status"], number>> = { working: 0x4cae9b, waiting_approval: 0xd89a34, error: 0xd35c5c, completed: 0x6aa9e9 };
    return colors[status] ?? 0x8798a5;
  }
}
