import Phaser from 'phaser';
import { CHUNK_SIZE, TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from '@/core/Constants.js';
import { TileMap } from '@/world/TileMap.js';
import { TilesetManager } from '@/world/TilesetManager.js';
import { eventBus } from '@/core/EventBus.js';

interface LoadedChunk {
  key: string;
  image: Phaser.GameObjects.Image;
}

export class ChunkRenderer {
  private scene: Phaser.Scene;
  private tileMap: TileMap;
  private tilesetManager: TilesetManager;
  private chunks: Map<string, LoadedChunk>;
  private chunksX: number;
  private chunksY: number;
  private dirtyChunks: Set<string>;

  constructor(scene: Phaser.Scene, tileMap: TileMap, tilesetManager: TilesetManager) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.tilesetManager = tilesetManager;
    this.chunks = new Map();
    this.dirtyChunks = new Set();
    this.chunksX = Math.ceil(WORLD_TILES_X / CHUNK_SIZE);
    this.chunksY = Math.ceil(WORLD_TILES_Y / CHUNK_SIZE);

    // Listen for tile changes to mark chunks dirty
    eventBus.on('tile:changed', (data) => {
      const chunkX = Math.floor(data.tileX / CHUNK_SIZE);
      const chunkY = Math.floor(data.tileY / CHUNK_SIZE);
      this.dirtyChunks.add(this.chunkKey(chunkX, chunkY));
    });
  }

  private chunkKey(chunkX: number, chunkY: number): string {
    return `chunk_${chunkX}_${chunkY}`;
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const visible = this.getVisibleChunks(camera);
    const visibleKeys = new Set(visible.map((c) => this.chunkKey(c.chunkX, c.chunkY)));

    // Load new visible chunks
    for (const { chunkX, chunkY } of visible) {
      const key = this.chunkKey(chunkX, chunkY);
      if (!this.chunks.has(key)) {
        this.loadChunk(chunkX, chunkY);
      } else if (this.dirtyChunks.has(key)) {
        this.refreshChunk(chunkX, chunkY);
        this.dirtyChunks.delete(key);
      }
    }

    // Unload offscreen chunks
    for (const [key, chunk] of this.chunks) {
      if (!visibleKeys.has(key)) {
        this.unloadChunk(parseInt(key.split('_')[1]!), parseInt(key.split('_')[2]!));
      }
    }
  }

  getVisibleChunks(
    camera: Phaser.Cameras.Scene2D.Camera,
  ): Array<{ chunkX: number; chunkY: number }> {
    const worldView = camera.worldView;
    const chunkWorldSize = CHUNK_SIZE * TILE_SIZE;

    const startChunkX = Math.max(0, Math.floor(worldView.x / chunkWorldSize));
    const startChunkY = Math.max(0, Math.floor(worldView.y / chunkWorldSize));
    const endChunkX = Math.min(
      this.chunksX - 1,
      Math.floor((worldView.x + worldView.width) / chunkWorldSize),
    );
    const endChunkY = Math.min(
      this.chunksY - 1,
      Math.floor((worldView.y + worldView.height) / chunkWorldSize),
    );

    const result: Array<{ chunkX: number; chunkY: number }> = [];
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        result.push({ chunkX: cx, chunkY: cy });
      }
    }
    return result;
  }

  loadChunk(chunkX: number, chunkY: number): void {
    const key = this.chunkKey(chunkX, chunkY);
    if (this.chunks.has(key)) return;

    const chunkWorldSize = CHUNK_SIZE * TILE_SIZE;
    const textureKey = `tex_${key}`;

    // Create canvas for this chunk
    const canvas = this.scene.textures.createCanvas(textureKey, chunkWorldSize, chunkWorldSize);
    if (!canvas) return;

    const ctx = canvas.getContext();
    if (!ctx) return;

    this.renderChunkToContext(ctx, chunkX, chunkY);
    canvas.refresh();

    // Create image from canvas texture
    const worldX = chunkX * chunkWorldSize + chunkWorldSize / 2;
    const worldY = chunkY * chunkWorldSize + chunkWorldSize / 2;
    const image = this.scene.add.image(worldX, worldY, textureKey);
    image.setOrigin(0.5, 0.5);
    image.setDepth(0);

    this.chunks.set(key, { key: textureKey, image });
  }

  unloadChunk(chunkX: number, chunkY: number): void {
    const key = this.chunkKey(chunkX, chunkY);
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    chunk.image.destroy();
    if (this.scene.textures.exists(chunk.key)) {
      this.scene.textures.remove(chunk.key);
    }
    this.chunks.delete(key);
  }

  refreshChunk(chunkX: number, chunkY: number): void {
    const key = this.chunkKey(chunkX, chunkY);
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    const textureKey = chunk.key;
    const texture = this.scene.textures.get(textureKey);
    if (!texture) return;

    const canvas = texture as Phaser.Textures.CanvasTexture;
    const ctx = canvas.getContext();
    if (!ctx) return;

    ctx.clearRect(0, 0, CHUNK_SIZE * TILE_SIZE, CHUNK_SIZE * TILE_SIZE);
    this.renderChunkToContext(ctx, chunkX, chunkY);
    canvas.refresh();
  }

  private renderChunkToContext(
    ctx: CanvasRenderingContext2D,
    chunkX: number,
    chunkY: number,
  ): void {
    const startTileX = chunkX * CHUNK_SIZE;
    const startTileY = chunkY * CHUNK_SIZE;

    for (let localY = 0; localY < CHUNK_SIZE; localY++) {
      for (let localX = 0; localX < CHUNK_SIZE; localX++) {
        const tileX = startTileX + localX;
        const tileY = startTileY + localY;

        const tileType = this.tileMap.getTile(tileX, tileY);
        const color = this.tilesetManager.getTileColor(tileType);
        const cssColor = this.tilesetManager.colorToCSS(color);

        const px = localX * TILE_SIZE;
        const py = localY * TILE_SIZE;

        ctx.fillStyle = cssColor;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  destroy(): void {
    for (const [key, chunk] of this.chunks) {
      chunk.image.destroy();
      if (this.scene.textures.exists(chunk.key)) {
        this.scene.textures.remove(chunk.key);
      }
    }
    this.chunks.clear();
    this.dirtyChunks.clear();
  }
}
