import Phaser from 'phaser';
import { hasComponent } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import Position from '@/game/ecs/components/Position.js';
import { Selectable } from '@/game/ecs/components/TagComponents.js';
import { SelectionManager } from '@/ui/SelectionManager.js';

const ACCENT_COLOR = 0xc9a227;
const FILL_ALPHA = 0.1;
const DASH_LENGTH = 8;
const GAP_LENGTH = 4;
const MAX_SELECTION = 50;
const DRAG_THRESHOLD = 4;

/**
 * Drag-Select: left-click + drag draws a selection rectangle.
 * On release, all Selectable entities inside are selected.
 * Shift+drag adds to current selection.
 * All visual elements are Phaser GameObjects.
 */
export class DragSelect {
  private scene: Phaser.Scene;
  private graphics!: Phaser.GameObjects.Graphics;
  private selectionGraphics!: Phaser.GameObjects.Graphics;

  private isDragging: boolean = false;
  private startX: number = -1;
  private startY: number = -1;

  private selectionManager: SelectionManager;

  private initialized = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.selectionManager = SelectionManager.getInstance();
    // Defer all GameObject creation — scene.add is not available until boot.
  }

  /** Call from HUDScene.create() after the scene is ready. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Drag box graphics (screen-space)
    this.graphics = this.scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(2500);

    // Selection highlight graphics (world-space)
    this.selectionGraphics = this.scene.add.graphics();
    this.selectionGraphics.setDepth(1500);
  }

  /**
   * Called from pointerdown. Records start position if left button.
   */
  onPointerDown(pointer: Phaser.Input.Pointer, shiftKey: boolean): void {
    if (!pointer.leftButtonDown()) return;

    // Don't start drag if an active god power is set
    this.startX = pointer.x;
    this.startY = pointer.y;
    this.isDragging = false; // Will become true in onPointerMove if threshold exceeded
  }

  /**
   * Called from pointermove. Draws selection rectangle if dragging.
   */
  onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.startX < 0 || this.startY < 0) return;

    const dx = pointer.x - this.startX;
    const dy = pointer.y - this.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!this.isDragging && dist > DRAG_THRESHOLD) {
      this.isDragging = true;
    }

    if (!this.isDragging) return;

    this.drawSelectionBox(pointer.x, pointer.y);
  }

  /**
   * Called from pointerup. Completes selection if dragging.
   * @returns true if a drag selection was performed (so caller can skip single-click selection)
   */
  onPointerUp(
    pointer: Phaser.Input.Pointer,
    shiftKey: boolean,
    world: GameWorld | null,
    sprites: Map<number, Phaser.GameObjects.Sprite> | null,
  ): boolean {
    this.graphics.clear();

    if (!this.isDragging) {
      // Not a drag — single click
      this.isDragging = false;
      this.startX = -1;
      this.startY = -1;
      return false;
    }

    // Save start position before resetting
    const savedStartX = this.startX;
    const savedStartY = this.startY;

    this.isDragging = false;
    this.startX = -1;
    this.startY = -1;

    if (!world || !sprites) return true;

    // Screen coords of the drag box
    const endX = pointer.x;
    const endY = pointer.y;

    const cam = this.scene.scene.get('Game').cameras.main;

    // Convert screen box corners to world coordinates
    const worldTL = this.screenToWorld(
      Math.min(savedStartX, endX),
      Math.min(savedStartY, endY),
      cam,
    );
    const worldBR = this.screenToWorld(
      Math.max(savedStartX, endX),
      Math.max(savedStartY, endY),
      cam,
    );

    // Find all Selectable entities inside the box
    const selectedIds: number[] = [];
    for (const [eid, sprite] of sprites) {
      if (selectedIds.length >= MAX_SELECTION) break;
      if (!hasComponent(world, eid, Selectable)) continue;

      const ex = sprite.x;
      const ey = sprite.y;

      if (ex >= worldTL.x && ex <= worldBR.x && ey >= worldTL.y && ey <= worldBR.y) {
        selectedIds.push(eid);
      }
    }

    if (shiftKey) {
      this.selectionManager.addMultipleToSelection(selectedIds);
    } else {
      this.selectionManager.selectMultiple(selectedIds);
    }

    return true;
  }

  /**
   * Draw selection highlights around currently selected entities.
   */
  updateSelectionHighlights(
    world: GameWorld | null,
    sprites: Map<number, Phaser.GameObjects.Sprite> | null,
  ): void {
    this.selectionGraphics.clear();

    if (!world || !sprites) return;

    const selected = this.selectionManager.getSelected();
    for (const eid of selected) {
      const sprite = sprites.get(eid);
      if (!sprite) continue;

      // Check entity still exists
      if (!hasComponent(world, eid, Position)) {
        this.selectionManager.removeFromSelection(eid);
        continue;
      }

      // Draw selection ring
      this.selectionGraphics.lineStyle(2, ACCENT_COLOR, 0.9);
      this.selectionGraphics.strokeCircle(sprite.x, sprite.y, 18);
    }
  }

  getIsDragging(): boolean {
    return this.isDragging;
  }

  destroy(): void {
    this.graphics.destroy();
    this.selectionGraphics.destroy();
  }

  private drawSelectionBox(currentX: number, currentY: number): void {
    this.graphics.clear();

    const x = Math.min(this.startX, currentX);
    const y = Math.min(this.startY, currentY);
    const w = Math.abs(currentX - this.startX);
    const h = Math.abs(currentY - this.startY);

    // Fill
    this.graphics.fillStyle(ACCENT_COLOR, FILL_ALPHA);
    this.graphics.fillRect(x, y, w, h);

    // Dashed border
    this.graphics.lineStyle(1, ACCENT_COLOR, 0.8);
    this.drawDashedRect(x, y, w, h);
  }

  private drawDashedRect(x: number, y: number, w: number, h: number): void {
    // Top
    this.drawDashedLine(x, y, x + w, y);
    // Right
    this.drawDashedLine(x + w, y, x + w, y + h);
    // Bottom
    this.drawDashedLine(x + w, y + h, x, y + h);
    // Left
    this.drawDashedLine(x, y + h, x, y);
  }

  private drawDashedLine(x1: number, y1: number, x2: number, y2: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const nx = dx / len;
    const ny = dy / len;

    let pos = 0;
    let drawing = true;
    while (pos < len) {
      const segLen = drawing ? DASH_LENGTH : GAP_LENGTH;
      const segEnd = Math.min(pos + segLen, len);

      if (drawing) {
        this.graphics.beginPath();
        this.graphics.moveTo(x1 + nx * pos, y1 + ny * pos);
        this.graphics.lineTo(x1 + nx * segEnd, y1 + ny * segEnd);
        this.graphics.strokePath();
      }

      pos = segEnd;
      drawing = !drawing;
    }
  }

  private screenToWorld(
    screenX: number,
    screenY: number,
    cam: Phaser.Cameras.Scene2D.Camera,
  ): { x: number; y: number } {
    return {
      x: cam.scrollX + screenX / cam.zoom,
      y: cam.scrollY + screenY / cam.zoom,
    };
  }
}
