import Phaser from 'phaser';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  CAMERA_PAN_SPEED,
  WORLD_TILES_X,
  WORLD_TILES_Y,
  TILE_SIZE,
} from '@/core/Constants.js';

const EDGE_SCROLL_MARGIN = 20;
const EDGE_SCROLL_SPEED = 300;
const SMOOTH_FACTOR = 0.12;

export class CameraController {
  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<string, Phaser.Input.Keyboard.Key>;
  private isDragging: boolean;
  private dragStartX: number;
  private dragStartY: number;
  private camStartScrollX: number;
  private camStartScrollY: number;
  private targetScrollX: number;
  private targetScrollY: number;
  private worldWidth: number;
  private worldHeight: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.camStartScrollX = 0;
    this.camStartScrollY = 0;
    this.worldWidth = WORLD_TILES_X * TILE_SIZE;
    this.worldHeight = WORLD_TILES_Y * TILE_SIZE;

    this.targetScrollX = scene.cameras.main.scrollX;
    this.targetScrollY = scene.cameras.main.scrollY;

    // Keyboard setup
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    // Mouse wheel zoom
    scene.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
      ) => {
        const cam = scene.cameras.main;
        const newZoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, MIN_ZOOM, MAX_ZOOM);
        cam.setZoom(newZoom);
      },
    );

    // Middle mouse button drag
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.camStartScrollX = scene.cameras.main.scrollX;
        this.camStartScrollY = scene.cameras.main.scrollY;
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const cam = scene.cameras.main;
        const dx = (pointer.x - this.dragStartX) / cam.zoom;
        const dy = (pointer.y - this.dragStartY) / cam.zoom;
        this.targetScrollX = this.camStartScrollX - dx;
        this.targetScrollY = this.camStartScrollY - dy;
      }
    });

    scene.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  update(_time: number, delta: number): void {
    const cam = this.scene.cameras.main;
    const dt = delta / 1000;

    // Keyboard panning
    const speed = CAMERA_PAN_SPEED * dt;
    const up = this.cursors.up?.isDown || this.wasd.up?.isDown;
    const down = this.cursors.down?.isDown || this.wasd.down?.isDown;
    const left = this.cursors.left?.isDown || this.wasd.left?.isDown;
    const right = this.cursors.right?.isDown || this.wasd.right?.isDown;

    if (up) this.targetScrollY -= speed;
    if (down) this.targetScrollY += speed;
    if (left) this.targetScrollX -= speed;
    if (right) this.targetScrollX += speed;

    // Edge scrolling
    if (!this.isDragging) {
      const pointer = this.scene.input.activePointer;
      const { width, height } = this.scene.scale;
      const edgeSpeed = EDGE_SCROLL_SPEED * dt;

      if (pointer.x < EDGE_SCROLL_MARGIN) this.targetScrollX -= edgeSpeed;
      if (pointer.x > width - EDGE_SCROLL_MARGIN) this.targetScrollX += edgeSpeed;
      if (pointer.y < EDGE_SCROLL_MARGIN) this.targetScrollY -= edgeSpeed;
      if (pointer.y > height - EDGE_SCROLL_MARGIN) this.targetScrollY += edgeSpeed;
    }

    // Clamp to world bounds
    const viewWidth = cam.width / cam.zoom;
    const viewHeight = cam.height / cam.zoom;
    this.targetScrollX = Phaser.Math.Clamp(this.targetScrollX, 0, this.worldWidth - viewWidth);
    this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY, 0, this.worldHeight - viewHeight);

    // Smooth interpolation
    cam.scrollX += (this.targetScrollX - cam.scrollX) * SMOOTH_FACTOR;
    cam.scrollY += (this.targetScrollY - cam.scrollY) * SMOOTH_FACTOR;
  }

  enableDrag(): void {
    this.isDragging = false;
  }

  disableDrag(): void {
    this.isDragging = false;
  }

  setZoom(zoom: number): void {
    const cam = this.scene.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(zoom, MIN_ZOOM, MAX_ZOOM));
  }

  centerOn(worldX: number, worldY: number): void {
    const cam = this.scene.cameras.main;
    const viewWidth = cam.width / cam.zoom;
    const viewHeight = cam.height / cam.zoom;
    this.targetScrollX = worldX - viewWidth / 2;
    this.targetScrollY = worldY - viewHeight / 2;
    cam.scrollX = this.targetScrollX;
    cam.scrollY = this.targetScrollY;
  }
}
