import Phaser from 'phaser';
import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import { TILE_SIZE } from '@/core/Constants.js';
import { TileType } from '@/core/Types.js';
import Position from '@/game/ecs/components/Position.js';
import Faction from '@/game/ecs/components/Faction.js';
import { Creature } from '@/game/ecs/components/TagComponents.js';
import type { TileMap } from '@/world/TileMap.js';
import { eventBus } from '@/core/EventBus.js';

const TILE_COLORS: Record<string, number> = {
  [TileType.DeepWater]: 0x1a3a5c,
  [TileType.ShallowWater]: 0x2e86c1,
  [TileType.Sand]: 0xf0d9b5,
  [TileType.Grass]: 0x27ae60,
  [TileType.Forest]: 0x1e8449,
  [TileType.DenseForest]: 0x145a32,
  [TileType.Mountain]: 0x7f8c8d,
  [TileType.Snow]: 0xecf0f1,
  [TileType.Desert]: 0xf0b27a,
  [TileType.Tundra]: 0xbdc3c7,
  [TileType.Swamp]: 0x4a6741,
  [TileType.Coral]: 0xff7f50,
  [TileType.Lava]: 0xe74c3c,
  [TileType.Void]: 0x1a1a2e,
};

const FACTION_COLORS = [0xffffff, 0x3498db, 0xe74c3c, 0x2ecc71, 0xf1c40f, 0x9b59b6];

export class Minimap {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle;
  private minimapImage: Phaser.GameObjects.Image;
  private viewportRect: Phaser.GameObjects.Graphics;
  private creatureDots: Phaser.GameObjects.Graphics;
  private worldWidth: number;
  private worldHeight: number;
  private mapSize: number;
  private scaleRatio: number;
  private tileMap: TileMap;
  private textureKey: string;
  private dirty: boolean = true;
  private territoryGrid: Uint8Array | null = null;
  private territoryDots: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, tileMap: TileMap, x: number, y: number, size: number) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.mapSize = size;
    this.worldWidth = tileMap.width;
    this.worldHeight = tileMap.height;
    this.scaleRatio = size / this.worldWidth;
    this.textureKey = `__minimap_${Date.now()}`;

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    // Border
    this.border = scene.add.rectangle(0, 0, size + 4, size + 4, 0x666666, 1);
    this.border.setOrigin(0, 0);
    this.border.setStrokeStyle(1, 0x999999);
    this.container.add(this.border);

    // Background
    this.background = scene.add.rectangle(2, 2, size, size, 0x1a1a2e, 1);
    this.background.setOrigin(0, 0);
    this.container.add(this.background);

    // Render tile map to canvas texture
    this.renderMinimapTexture();

    this.minimapImage = scene.add.image(2, 2, this.textureKey);
    this.minimapImage.setOrigin(0, 0);
    this.minimapImage.setDisplaySize(size, size);
    this.container.add(this.minimapImage);

    // Creature dots layer
    this.creatureDots = scene.add.graphics();
    this.creatureDots.setPosition(2, 2);
    this.container.add(this.creatureDots);

    // Viewport rectangle
    this.viewportRect = scene.add.graphics();
    this.viewportRect.setPosition(2, 2);
    this.container.add(this.viewportRect);

    // Click to navigate
    this.background.setInteractive({ useHandCursor: true });
    this.background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.background.x;
      const localY = pointer.y - this.background.y;
      this.navigateTo(localX, localY);
    });

    // Territory overlay dots
    this.territoryDots = scene.add.graphics();
    this.territoryDots.setPosition(2, 2);
    this.container.add(this.territoryDots);

    // Listen for territory updates
    eventBus.on('territory:updated', (data: { grid: Uint8Array }) => {
      this.territoryGrid = data.grid;
    });
  }

  private renderMinimapTexture(): void {
    const canvas = this.scene.textures.createCanvas(
      this.textureKey,
      this.worldWidth,
      this.worldHeight,
    );
    if (!canvas) return;

    const ctx = canvas.getContext();

    for (let y = 0; y < this.worldHeight; y++) {
      for (let x = 0; x < this.worldWidth; x++) {
        const tileType = this.tileMap.getTile(x, y);
        const color = TILE_COLORS[tileType] ?? 0x1a1a2e;
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.fillRect(x, y, 1, 1);
      }
    }

    canvas.refresh();
    this.dirty = false;
  }

  /** Mark minimap terrain as needing re-render (e.g., after terraform). */
  markDirty(): void {
    this.dirty = true;
  }

  private navigateTo(localX: number, localY: number): void {
    const gameScene = this.scene.scene.get('Game');
    const cam = gameScene.cameras.main;
    if (!cam) return;

    const worldX = (localX / this.mapSize) * this.worldWidth * TILE_SIZE;
    const worldY = (localY / this.mapSize) * this.worldHeight * TILE_SIZE;

    cam.centerOn(worldX, worldY);
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, world: GameWorld): void {
    // Re-render terrain if dirty
    if (this.dirty) {
      const existing = this.scene.textures.get(this.textureKey);
      if (existing) {
        this.scene.textures.remove(this.textureKey);
      }
      this.renderMinimapTexture();
      this.minimapImage.setTexture(this.textureKey);
    }

    // Update viewport rectangle
    this.viewportRect.clear();
    this.viewportRect.lineStyle(1, 0xffffff, 0.8);

    const vpWorldX = camera.scrollX / TILE_SIZE;
    const vpWorldY = camera.scrollY / TILE_SIZE;
    const vpWorldW = camera.width / camera.zoom / TILE_SIZE;
    const vpWorldH = camera.height / camera.zoom / TILE_SIZE;

    const vpX = vpWorldX * this.scaleRatio;
    const vpY = vpWorldY * this.scaleRatio;
    const vpW = vpWorldW * this.scaleRatio;
    const vpH = vpWorldH * this.scaleRatio;

    this.viewportRect.strokeRect(vpX, vpY, vpW, vpH);

    // Draw territory overlay (faction colored dots)
    this.territoryDots.clear();
    if (this.territoryGrid) {
      // Sample every 4th tile for performance
      const step = 4;
      for (let y = 0; y < this.worldHeight; y += step) {
        for (let x = 0; x < this.worldWidth; x += step) {
          const factionId = this.territoryGrid[y * this.worldWidth + x];
          if (factionId > 0) {
            const color = FACTION_COLORS[factionId % FACTION_COLORS.length] ?? 0xffffff;
            this.territoryDots.fillStyle(color, 0.3);
            const dx = x * this.scaleRatio;
            const dy = y * this.scaleRatio;
            const size = step * this.scaleRatio;
            this.territoryDots.fillRect(dx, dy, size, size);
          }
        }
      }
    }

    // Draw creature dots
    this.creatureDots.clear();

    const creatures = query(world, [Position, Creature]);
    for (let i = 0; i < creatures.length; i++) {
      const eid = creatures[i];
      const worldX = Position.x[eid] / TILE_SIZE;
      const worldY = Position.y[eid] / TILE_SIZE;

      const dotX = worldX * this.scaleRatio;
      const dotY = worldY * this.scaleRatio;

      // Get faction color
      let color = 0xffffff;
      if (hasComponent(world, eid, Faction)) {
        const fId = Math.floor(Faction.id[eid]);
        color = FACTION_COLORS[fId % FACTION_COLORS.length];
      }

      this.creatureDots.fillStyle(color, 0.9);
      this.creatureDots.fillRect(dotX - 1, dotY - 1, 2, 2);
    }
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  destroy(): void {
    if (this.scene.textures.exists(this.textureKey)) {
      this.scene.textures.remove(this.textureKey);
    }
    this.container.destroy();
  }
}
