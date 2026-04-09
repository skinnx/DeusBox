import Phaser from 'phaser';
import { addEntity, addComponent, getAllEntities, hasComponent, removeEntity } from 'bitecs';
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
import { createAISystem } from '@/game/ecs/systems/AISystem.js';
import { createNeedsDecaySystem } from '@/game/ecs/systems/NeedsDecaySystem.js';
import { createPathfindingSystem } from '@/game/ecs/systems/PathfindingSystem.js';
import { createResourceSystem, resourceTypeToIndex } from '@/game/ecs/systems/ResourceSystem.js';
import { createFactionSystem } from '@/game/ecs/systems/FactionSystem.js';
import { createBuildingSystem } from '@/game/ecs/systems/BuildingSystem.js';
import { createReproductionSystem } from '@/game/ecs/systems/ReproductionSystem.js';
import { createCombatSystem } from '@/game/ecs/systems/CombatSystem.js';
import { createRelationshipSystem } from '@/game/ecs/systems/RelationshipSystem.js';
import { createStorytellerSystem } from '@/game/ecs/systems/StorytellerSystem.js';
import { createSpatialIndexSystem } from '@/game/ecs/systems/SpatialIndexSystem.js';
import { createMilitarySystem } from '@/game/ecs/systems/MilitarySystem.js';
import { createSeasonSystem } from '@/game/ecs/systems/SeasonSystem.js';
import { createWeatherSystem } from '@/game/ecs/systems/WeatherSystem.js';
import { createTerritorySystem } from '@/game/ecs/systems/TerritorySystem.js';
import { createDiplomacySystem } from '@/game/ecs/systems/DiplomacySystem.js';
import { createSiegeSystem } from '@/game/ecs/systems/SiegeSystem.js';
import { createWarEventSystem } from '@/game/ecs/systems/WarEventSystem.js';
import { createCraftingSystem } from '@/game/ecs/systems/CraftingSystem.js';
import { createTradeSystem } from '@/game/ecs/systems/TradeSystem.js';
import { createTechSystem } from '@/game/ecs/systems/TechSystem.js';
import { createAnimationSystem } from '@/game/ecs/systems/AnimationSystem.js';
import { spawnCreature, entityTypes } from '@/game/ecs/factories/CreatureFactory.js';
import { TileMap } from '@/world/TileMap.js';
import { TerraformTool } from '@/god/TerraformTool.js';
import { SpawnTool } from '@/god/SpawnTool.js';
import { DisasterTool } from '@/god/DisasterTool.js';
import { GodPowers } from '@/god/GodPowers.js';
import { InputHandler } from '@/game/input/InputHandler.js';
import Position from '@/game/ecs/components/Position.js';
import Velocity from '@/game/ecs/components/Velocity.js';
import Health from '@/game/ecs/components/Health.js';
import Needs from '@/game/ecs/components/Needs.js';
import SpriteRef from '@/game/ecs/components/SpriteRef.js';
import AIStateComponent from '@/game/ecs/components/AIState.js';
import Faction from '@/game/ecs/components/Faction.js';
import Pathfinder from '@/game/ecs/components/Pathfinder.js';
import Combat from '@/game/ecs/components/Combat.js';
import Reproduction from '@/game/ecs/components/Reproduction.js';
import Inventory from '@/game/ecs/components/Inventory.js';
import ResourceSource from '@/game/ecs/components/ResourceSource.js';
import Structure from '@/game/ecs/components/Structure.js';
import {
  Creature,
  Selectable,
  Humanoid,
  Animal,
  Resource,
  Dead,
} from '@/game/ecs/components/TagComponents.js';
import { TileType, ResourceType, AIState, WeatherType } from '@/core/Types.js';
import { hashTextureKey, destroyEntitySprite } from '@/game/ecs/systems/RenderSyncSystem.js';
import { DayNightCycle } from '@/game/effects/DayNightCycle.js';
import { ParticleSystem } from '@/game/effects/ParticleSystem.js';
import { AudioManager } from '@/game/audio/AudioManager.js';
import { AmbientMusicGenerator } from '@/game/audio/AmbientMusicGenerator.js';
import { SaveManager } from '@/game/save/SaveManager.js';
import type { SaveGameData, SaveSlot, SavedEntity } from '@/game/save/SaveData.js';
import { settings } from '@/core/Settings.js';
import { perfMonitor } from '@/core/PerformanceMonitor.js';
import { errorHandler } from '@/core/ErrorHandler.js';
import { SceneTransition } from '@/ui/SceneTransition.js';

import creatureData from '@/data/creatures.json';

export class GameScene extends Phaser.Scene {
  private frameCount = 0;
  private chunkRenderer: ChunkRenderer | null = null;
  private cameraController: CameraController | null = null;
  private ecsHost: ECSHost;
  private sprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private inputHandler: InputHandler | null = null;
  private disasterTool: DisasterTool | null = null;
  private tileMap: TileMap | null = null;
  private dayNightCycle: DayNightCycle | null = null;
  private particleSystem: ParticleSystem | null = null;
  private audioManager: AudioManager;
  private speedMultiplier: number = 1;
  private gameTime: number = 0;
  private seed: number = 42;
  private autoSaveTimer: number = 0;
  private static readonly AUTO_SAVE_INTERVAL = 60000;
  private ambientMusic: AmbientMusicGenerator;
  private transition: SceneTransition | null = null;

  constructor() {
    super('Game');
    this.ecsHost = ECSHost.getInstance();
    this.audioManager = AudioManager.getInstance();
    this.ambientMusic = new AmbientMusicGenerator();
  }

  create(): void {
    console.log('[GameScene] Initializing procedural world...');

    // Clear systems from any previous scene lifecycle
    this.ecsHost.clearSystems();

    const worldWidth = WORLD_TILES_X * TILE_SIZE;
    const worldHeight = WORLD_TILES_Y * TILE_SIZE;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // 1. Biome manager
    const biomeManager = new BiomeManager();

    // 2. Generate world
    console.time('[GameScene] World generation');
    const worldGenerator = new WorldGenerator(biomeManager);
    const tileMap = worldGenerator.generate(this.seed);
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

    // Store tileMap reference for god powers
    this.tileMap = tileMap;

    // ── ECS Initialization ────────────────────────────────────────────

    // Register systems in order: SpatialIndex → Time → NeedsDecay → AI → Pathfinding → Movement → RenderSync
    this.ecsHost.registerSystem(createSpatialIndexSystem());
    this.ecsHost.registerSystem(createTimeSystem());
    this.ecsHost.registerSystem(createNeedsDecaySystem());
    this.ecsHost.registerSystem(createAISystem(tileMap));
    this.ecsHost.registerSystem(createPathfindingSystem(tileMap));
    this.ecsHost.registerSystem(createMovementSystem(worldWidth, worldHeight));
    // Wave 18: Animation updates before render
    this.ecsHost.registerSystem(createAnimationSystem());
    this.ecsHost.registerSystem(createRenderSyncSystem(this, this.sprites));

    // Wave 6 systems: Resource → Faction → Relationship → Building → Reproduction → Combat → Storyteller
    this.ecsHost.registerSystem(createResourceSystem());
    this.ecsHost.registerSystem(createFactionSystem());
    this.ecsHost.registerSystem(createRelationshipSystem());
    this.ecsHost.registerSystem(createBuildingSystem(tileMap));
    this.ecsHost.registerSystem(createReproductionSystem(this, this.sprites));
    this.ecsHost.registerSystem(createCombatSystem(this.sprites));
    this.ecsHost.registerSystem(createStorytellerSystem({ worldWidth, worldHeight }));

    // Wave 10 systems: Season → Weather
    this.ecsHost.registerSystem(createSeasonSystem());
    this.ecsHost.registerSystem(createWeatherSystem());

    // Wave 12 systems: Territory → Diplomacy
    this.ecsHost.registerSystem(createTerritorySystem());
    this.ecsHost.registerSystem(createDiplomacySystem());

    // Wave 13 system: Military (runs before Combat so role modifiers are applied)
    this.ecsHost.registerSystem(createMilitarySystem());

    // Wave 14 systems: Siege & War Events
    this.ecsHost.registerSystem(createSiegeSystem(this.sprites));
    this.ecsHost.registerSystem(createWarEventSystem());

    // Wave 15 system: Crafting (auto-craft equipment near buildings)
    this.ecsHost.registerSystem(createCraftingSystem());

    // Wave 17 system: Trade (marketplace auto-trading)
    this.ecsHost.registerSystem(createTradeSystem());

    // Wave 16 system: Research (tech tree)
    this.ecsHost.registerSystem(createTechSystem());

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

    // ── Spawn terrain resource entities ──────────────────────────────────
    spawnTerrainResources(this.ecsHost.world, tileMap, cx, cy, 60);
    console.log('[GameScene] Terrain resources spawned');

    // ── God Powers Initialization ────────────────────────────────────────

    const terraformTool = new TerraformTool(tileMap, this.chunkRenderer);
    const spawnTool = new SpawnTool(this.ecsHost.world, this);
    this.disasterTool = new DisasterTool(this, this.ecsHost.world, tileMap);

    const godPowers = new GodPowers(
      this.ecsHost.world,
      tileMap,
      this,
      terraformTool,
      spawnTool,
      this.disasterTool,
    );

    this.inputHandler = new InputHandler(
      this,
      godPowers,
      terraformTool,
      spawnTool,
      this.disasterTool,
    );

    console.log('[GameScene] God powers system initialized');

    // ── Wave 7: Day/Night Cycle ──────────────────────────────────────────
    this.dayNightCycle = new DayNightCycle(this);

    // ── Wave 7: Particle System ──────────────────────────────────────────
    this.particleSystem = new ParticleSystem(this);

    // ── Wave 7: Audio Manager ────────────────────────────────────────────
    // Init on first pointer down
    this.transition = new SceneTransition(this);
    this.transition.fadeIn({ duration: 600 });

    this.input.once('pointerdown', () => {
      this.audioManager.init();
      const ctx = this.audioManager.getAudioContext();
      if (ctx) {
        this.ambientMusic.init(ctx);
        this.ambientMusic.setMood('peaceful');
        this.ambientMusic.start();
      }
    });

    // ── Wave 7: Keyboard shortcuts for save/load ─────────────────────────
    this.setupSaveLoadKeys();

    // ── Wave 7: Environmental particles based on biome ───────────────────
    this.spawnEnvironmentalParticles(cx, cy);

    // ── Wave 7: Listen for combat events to trigger blood particles ──────
    eventBus.on('damage:dealt', (data) => {
      if (this.particleSystem && data.source === 'combat') {
        this.particleSystem.createBloodSplatter(
          Position.x[data.entityId] ?? 0,
          Position.y[data.entityId] ?? 0,
        );
      }
    });

    // ── Wave 7: Listen for entity spawns to play audio ───────────────────
    eventBus.on('entity:spawned', () => {
      this.audioManager.playEntitySpawn();
    });

    // ── Wave 7: Listen for disasters to play audio ───────────────────────
    eventBus.on('disaster:start', () => {
      this.audioManager.playDisaster();
    });

    // ── Wave 10: Listen for weather changes to update particles ───────────
    eventBus.on('weather:changed', (data) => {
      if (!this.particleSystem) return;
      const cam = this.cameras.main;
      const viewX = cam.scrollX;
      const viewY = cam.scrollY;
      const viewW = cam.width;
      const viewH = cam.height;

      // Stop existing weather particles
      this.particleSystem.stopSystem('rain');
      this.particleSystem.stopSystem('snow');
      this.particleSystem.stopSystem('storm');
      this.particleSystem.stopSystem('fog');

      switch (data.weather) {
        case WeatherType.Rain:
          this.particleSystem.createRain(viewX, viewY, viewW, viewH);
          break;
        case WeatherType.Storm:
          this.particleSystem.createStorm(viewX, viewY, viewW, viewH);
          break;
        case WeatherType.Snow:
          this.particleSystem.createSnow(viewX, viewY, viewW, viewH);
          break;
        case WeatherType.Fog:
          this.particleSystem.createFog(viewX, viewY, viewW, viewH);
          break;
      }
    });

    eventBus.emit('scene:change', { scene: 'Game' });
    console.log('[GameScene] World ready — 256x256 tiles, procedural biomes, creatures spawned');
  }

  shutdown(): void {
    this.ambientMusic.stop();
    this.ambientMusic.destroy();
    eventBus.removeAllListeners('damage:dealt');
    eventBus.removeAllListeners('entity:spawned');
    eventBus.removeAllListeners('disaster:start');
    eventBus.removeAllListeners('weather:changed');
    eventBus.removeAllListeners('season:changed');
    eventBus.removeAllListeners('territory:updated');
    eventBus.removeAllListeners('diplomacy:changed');
    eventBus.removeAllListeners('building:destroyed');
    eventBus.removeAllListeners('research:started');
    eventBus.removeAllListeners('research:completed');
    eventBus.removeAllListeners('entity:hover');
    eventBus.removeAllListeners('entity:destroyed');
  }

  update(time: number, delta: number): void {
    this.frameCount++;

    const fps = this.game.loop.actualFps;
    const entityCount = getAllEntities(this.ecsHost.world).length;
    perfMonitor.update(fps, delta, entityCount);

    // Track game time
    this.gameTime += delta * this.speedMultiplier;

    // Run ECS systems
    this.ecsHost.tick(delta);

    // Update god powers input
    if (this.inputHandler) {
      this.inputHandler.update();
    }

    // Process active disasters
    if (this.disasterTool) {
      this.disasterTool.update(delta);
    }

    // Update camera
    if (this.cameraController) {
      this.cameraController.update(time, delta);
    }

    // Update chunks (load/unload based on camera viewport)
    if (this.chunkRenderer) {
      this.chunkRenderer.update(this.cameras.main);
    }

    // ── Wave 7 updates ───────────────────────────────────────────────────

    // Day/night cycle
    if (this.dayNightCycle) {
      this.dayNightCycle.update(delta, this.speedMultiplier);
    }

    // Particle system
    if (this.particleSystem) {
      this.particleSystem.update(delta);
    }

    if (settings.getGameplay().autoSave) {
      this.autoSaveTimer += delta;
      const interval = settings.getGameplay().autoSaveInterval;
      if (this.autoSaveTimer >= interval) {
        this.autoSaveTimer = 0;
        this.autoSave(1);
      }
    }

    if (this.dayNightCycle && !settings.getGraphics().dayNightCycle) {
      this.dayNightCycle.update(0, 0);
    }

    // ── Wave 8: Entity hover detection ──────────────────────────────────
    this.detectEntityHover();
  }

  // ── Wave 8: Hover detection for tooltips ──────────────────────────

  private hoverFrameCounter: number = 0;
  private lastHoveredEid: number = -1;

  private detectEntityHover(): void {
    // Run every 3 frames to reduce overhead
    this.hoverFrameCounter++;
    if (this.hoverFrameCounter % 3 !== 0) return;

    const pointer = this.input.activePointer;
    const cam = this.cameras.main;
    const worldX = cam.scrollX + pointer.x / cam.zoom;
    const worldY = cam.scrollY + pointer.y / cam.zoom;

    const HOVER_RADIUS = 24;
    let closestEid = -1;
    let closestDist = HOVER_RADIUS;

    for (const [eid, sprite] of this.sprites) {
      if (!hasComponent(this.ecsHost.world, eid, Selectable)) continue;
      const dx = sprite.x - worldX;
      const dy = sprite.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestEid = eid;
      }
    }

    if (closestEid !== this.lastHoveredEid) {
      this.lastHoveredEid = closestEid;
      eventBus.emit('entity:hover', { entityId: closestEid, worldX, worldY });
    }
  }

  // ── Public API for SaveManager ────────────────────────────────────────

  getSaveGameData(): SaveGameData {
    const cam = this.cameras.main;
    return {
      seed: this.seed,
      gameTime: this.gameTime,
      speedMultiplier: this.speedMultiplier,
      camera: {
        x: cam.scrollX,
        y: cam.scrollY,
        zoom: cam.zoom,
      },
      world: this.ecsHost.world,
      tileMap: this.tileMap!,
      sprites: this.sprites,
    };
  }

  loadFromSave(slot: number): void {
    const saveSlot = SaveManager.load(slot);
    if (!saveSlot) {
      console.warn(`[GameScene] No save found in slot ${slot}`);
      return;
    }

    // Clear existing entities
    SaveManager.clearWorld(this.ecsHost.world, this.sprites);

    // Restore tile data
    if (this.tileMap) {
      const tiles = SaveManager.base64ToUint8(saveSlot.tiles.data);
      for (let y = 0; y < WORLD_TILES_Y; y++) {
        for (let x = 0; x < WORLD_TILES_X; x++) {
          const idx = tiles[y * WORLD_TILES_X + x]!;
          const tileTypes = Object.values(TileType);
          if (idx < tileTypes.length) {
            this.tileMap.setTile(x, y, tileTypes[idx]!);
          }
        }
      }
    }

    // Restore camera
    this.cameras.main.setScroll(saveSlot.camera.x, saveSlot.camera.y);
    this.cameras.main.setZoom(saveSlot.camera.zoom);

    // Restore game state
    this.gameTime = saveSlot.gameTime;
    this.speedMultiplier = saveSlot.speedMultiplier;

    // Restore day/night cycle time
    if (this.dayNightCycle) {
      this.dayNightCycle.setGameTime(
        (this.gameTime / 1000 / 300) * 300, // Convert to cycle seconds
      );
    }

    // Rebuild chunk renderer
    if (this.chunkRenderer) {
      this.chunkRenderer.update(this.cameras.main);
    }

    // Restore entities
    for (const saved of saveSlot.entities) {
      this.restoreEntity(saved);
    }

    console.log(`[GameScene] Restored ${saveSlot.entities.length} entities from slot ${slot}`);
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  getGameTime(): number {
    return this.gameTime;
  }

  getDayNightCycle(): DayNightCycle | null {
    return this.dayNightCycle;
  }

  getParticleSystem(): ParticleSystem | null {
    return this.particleSystem;
  }

  getAudioManager(): AudioManager {
    return this.audioManager;
  }

  getECSHost(): ECSHost {
    return this.ecsHost;
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private setupSaveLoadKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    // F5 = Quick save to slot 1
    keyboard.on('keydown-F5', () => {
      this.autoSave(1);
      this.audioManager.playUIClick();
    });

    // F9 = Quick load from slot 1
    keyboard.on('keydown-F9', () => {
      this.loadFromSave(1);
      this.audioManager.playUIClick();
    });
  }

  private autoSave(slot: number): void {
    const data = this.getSaveGameData();
    const success = SaveManager.save(slot, data);
    if (success) {
      console.log(`[GameScene] Auto-saved to slot ${slot}`);
    }
  }

  private restoreEntity(saved: SavedEntity): void {
    const world = this.ecsHost.world;

    if (saved.type === 'creature' && saved.creatureType) {
      const eid = spawnCreature(world, saved.creatureType, saved.x, saved.y, saved.faction.id);

      // Restore saved component data
      if (eid >= 0) {
        Health.current[eid] = saved.health.current;
        Health.max[eid] = saved.health.max;

        if (saved.needs) {
          Needs.hunger[eid] = saved.needs.hunger;
          Needs.rest[eid] = saved.needs.rest;
          Needs.social[eid] = saved.needs.social;
          Needs.fun[eid] = saved.needs.fun;
        }

        Faction.id[eid] = saved.faction.id;
        Faction.reputation[eid] = saved.faction.reputation;

        if (saved.aiState !== undefined) {
          AIStateComponent.state[eid] = saved.aiState;
        }

        if (saved.age !== undefined && hasComponent(world, eid, Reproduction)) {
          Reproduction.age[eid] = saved.age;
        }
      }
    }
  }

  private spawnEnvironmentalParticles(centerX: number, centerY: number): void {
    if (!this.particleSystem || !this.tileMap) return;

    // Check camera viewport biome for weather
    const cam = this.cameras.main;
    const viewX = cam.scrollX;
    const viewY = cam.scrollY;
    const viewW = cam.width;
    const viewH = cam.height;

    // Check center tile for biome
    const tileX = Math.floor((viewX + viewW / 2) / TILE_SIZE);
    const tileY = Math.floor((viewY + viewH / 2) / TILE_SIZE);
    const tile = this.tileMap.getTile(tileX, tileY);

    if (tile === TileType.Tundra || tile === TileType.Snow) {
      this.particleSystem.createSnow(viewX, viewY, viewW, viewH);
    } else if (tile === TileType.DeepWater || tile === TileType.ShallowWater) {
      this.particleSystem.createRain(viewX, viewY, viewW, viewH);
    }
  }
}

/**
 * Spawns ResourceSource entities at terrain-appropriate locations.
 * Forest/DenseForest → Wood, Grass → Food, Mountain → Stone.
 */
function spawnTerrainResources(
  world: ReturnType<typeof ECSHost.getInstance>['world'],
  tileMap: TileMap,
  centerX: number,
  centerY: number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const x = centerX + (Math.random() - 0.5) * 1000;
    const y = centerY + (Math.random() - 0.5) * 1000;
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    const tile = tileMap.getTile(tileX, tileY);

    let resourceTypeIndex = -1;
    let amount = 0;

    switch (tile) {
      case TileType.Forest:
      case TileType.DenseForest:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Wood);
        amount = 50 + Math.random() * 50;
        break;
      case TileType.Grass:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Food);
        amount = 30 + Math.random() * 30;
        break;
      case TileType.Mountain:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Stone);
        amount = 40 + Math.random() * 40;
        break;
      case TileType.Swamp:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Herbs);
        amount = 20 + Math.random() * 20;
        break;
      case TileType.Lava:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Crystal);
        amount = 10 + Math.random() * 15;
        break;
      case TileType.Coral:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Stone);
        amount = 25 + Math.random() * 25;
        break;
      default:
        continue;
    }

    const eid = addEntity(world);
    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;

    addComponent(world, eid, ResourceSource);
    ResourceSource.type[eid] = resourceTypeIndex;
    ResourceSource.amount[eid] = amount;
    ResourceSource.harvestTime[eid] = 2;

    addComponent(world, eid, Resource);
  }
}
