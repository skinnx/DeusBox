import Phaser from 'phaser';
import {
  WORLD_TILES_X,
  WORLD_TILES_Y,
  TILE_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  CAMERA_ZOOM_SPEED,
} from '@/core/Constants.js';
import { eventBus } from '@/core/EventBus.js';

export class GameScene extends Phaser.Scene {
  private frameCount = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    console.log('[GameScene] Initializing game world...');

    const worldWidth = WORLD_TILES_X * TILE_SIZE;
    const worldHeight = WORLD_TILES_Y * TILE_SIZE;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // Camera controls
    const cursors = this.input.keyboard!.createCursorKeys();
    const wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.data.set('cursors', cursors);
    this.data.set('wasd', wasd);

    // Initial camera position and zoom
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

    // Create test grid
    this.createTestGrid();

    // Camera zoom with scroll wheel
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
      ) => {
        const cam = this.cameras.main;
        const newZoom = Phaser.Math.Clamp(
          cam.zoom - dy * CAMERA_ZOOM_SPEED * 0.01,
          MIN_ZOOM,
          MAX_ZOOM,
        );
        cam.setZoom(newZoom);
      },
    );

    eventBus.emit('scene:change', { scene: 'Game' });
  }

  update(_time: number, delta: number): void {
    this.frameCount++;

    if (this.frameCount % 60 === 0) {
      console.log(`[GameScene] Frame ${this.frameCount}, delta: ${delta.toFixed(1)}ms`);
    }

    // Camera panning
    const cursors = this.data.get('cursors') as Phaser.Types.Input.Keyboard.CursorKeys;
    const wasd = this.data.get('wasd') as Record<string, Phaser.Input.Keyboard.Key>;

    if (cursors || wasd) {
      const cam = this.cameras.main;
      const speed = 400 * (delta / 1000);
      const zoom = cam.zoom;

      const up = cursors.up?.isDown || wasd?.up?.isDown;
      const down = cursors.down?.isDown || wasd?.down?.isDown;
      const left = cursors.left?.isDown || wasd?.left?.isDown;
      const right = cursors.right?.isDown || wasd?.right?.isDown;

      if (up) cam.scrollY -= speed / zoom;
      if (down) cam.scrollY += speed / zoom;
      if (left) cam.scrollX -= speed / zoom;
      if (right) cam.scrollX += speed / zoom;
    }
  }

  private createTestGrid(): void {
    const gridSize = 16;
    const offsetX = (WORLD_TILES_X / 2 - gridSize / 2) * TILE_SIZE;
    const offsetY = (WORLD_TILES_Y / 2 - gridSize / 2) * TILE_SIZE;

    const tileTypes = [
      'tile_deepWater',
      'tile_shallowWater',
      'tile_sand',
      'tile_grass',
      'tile_forest',
      'tile_denseForest',
      'tile_mountain',
      'tile_snow',
      'tile_desert',
      'tile_tundra',
    ];

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tileIndex = (x + y * 3) % tileTypes.length;
        this.add.image(offsetX + x * TILE_SIZE, offsetY + y * TILE_SIZE, tileTypes[tileIndex]);
      }
    }
  }
}
