import Phaser from 'phaser';
import { WORLD_TILES_X, WORLD_TILES_Y, TILE_SIZE } from '@/core/Constants.js';
import { eventBus } from '@/core/EventBus.js';
import { BiomeManager } from '@/world/BiomeManager.js';
import { WorldGenerator } from '@/world/WorldGenerator.js';
import { TilesetManager } from '@/world/TilesetManager.js';
import { ChunkRenderer } from '@/world/ChunkRenderer.js';
import { CameraController } from '@/game/camera/CameraController.js';
import { ECSHost } from '@/game/ecs/ECSHost.js';
import { createTimeSystem } from '@/game/ecs/systems/TimeSystem.js';
import { createMovementSystem } from '@/game/ecs/systems/MovementSystem.js';
import { createRenderSyncSystem } from '@/game/ecs/systems/RenderSyncSystem.js';
import { spawnCreature } from '@/game/ecs/factories/CreatureFactory.js';
import { getAllEntities } from 'bitecs';

export class GameScene extends Phaser.Scene {
  private frameCount = 0;
  private chunkRenderer: ChunkRenderer | null = null;
  private cameraController: CameraController | null = null;
  private ecsHost: ECSHost;
  private sprites: Map<number, Phaser.GameObjects.Sprite> = new Map();

  constructor() {
    super('Game');
    this.ecsHost = ECSHost.getInstance();
  }

  create(): void {
    console.log('[GameScene] Initializing procedural world...');

    const worldWidth = WORLD_TILES_X * TILE_SIZE;
    const worldHeight = WORLD_TILES_Y * TILE_SIZE;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // 1. Biome manager
    const biomeManager = new BiomeManager();

    // 2. Generate world
    console.time('[GameScene] World generation');
    const worldGenerator = new WorldGenerator(biomeManager);
    const tileMap = worldGenerator.generate(42);
    console.timeEnd('[GameScene] World generation');

    // 3. Tileset manager
    const tilesetManager = new TilesetManager();

    // 4. Chunk renderer
    this.chunkRenderer = new ChunkRenderer(this, tileMap, tilesetManager);

    // 5. Camera controller
    this.cameraController = new CameraController(this);

    // 6. Center camera on world
    this.cameraController.centerOn(worldWidth / 2, worldHeight / 2);
    this.cameraController.setZoom(2);

    // Initial chunk load
    this.chunkRenderer.update(this.cameras.main);

    // ── ECS Initialization ────────────────────────────────────────────

    // Register systems in order: Time → Movement → RenderSync
    this.ecsHost.registerSystem(createTimeSystem());
    this.ecsHost.registerSystem(createMovementSystem(worldWidth, worldHeight));
    this.ecsHost.registerSystem(createRenderSyncSystem(this, this.sprites));

    // Spawn test creatures around the center of the world
    const cx = worldWidth / 2;
    const cy = worldHeight / 2;

    // 5 humans
    for (let i = 0; i < 5; i++) {
      spawnCreature(
        this.ecsHost.world,
        'human',
        cx + (Math.random() - 0.5) * 400,
        cy + (Math.random() - 0.5) * 400,
        1,
      );
    }

    // 3 elves
    for (let i = 0; i < 3; i++) {
      spawnCreature(
        this.ecsHost.world,
        'elf',
        cx + (Math.random() - 0.5) * 400,
        cy + (Math.random() - 0.5) * 400,
        2,
      );
    }

    // 2 wolves
    for (let i = 0; i < 2; i++) {
      spawnCreature(
        this.ecsHost.world,
        'wolf',
        cx + (Math.random() - 0.5) * 500,
        cy + (Math.random() - 0.5) * 500,
        0,
      );
    }

    const entityCount = getAllEntities(this.ecsHost.world).length;
    console.log(`[GameScene] ECS initialized with ${entityCount} entities`);

    eventBus.emit('scene:change', { scene: 'Game' });
    console.log('[GameScene] World ready — 256x256 tiles, procedural biomes, creatures spawned');
  }

  update(time: number, delta: number): void {
    this.frameCount++;

    if (this.frameCount % 120 === 0) {
      const fps = this.game.loop.actualFps;
      console.log(
        `[GameScene] Frame ${this.frameCount} | FPS: ${fps.toFixed(0)} | Delta: ${delta.toFixed(1)}ms`,
      );
    }

    // Run ECS systems
    this.ecsHost.tick(delta);

    // Update camera
    if (this.cameraController) {
      this.cameraController.update(time, delta);
    }

    // Update chunks (load/unload based on camera viewport)
    if (this.chunkRenderer) {
      this.chunkRenderer.update(this.cameras.main);
    }
  }
}
