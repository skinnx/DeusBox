import Phaser from 'phaser';
import { eventBus } from '@/core/EventBus.js';
import { TILE_SIZE } from '@/core/Constants.js';

const FACTION_COLORS: Record<number, number> = {
  1: 0x3498db,  // Blue
  2: 0xe74c3c,  // Red
  3: 0x2ecc71,  // Green
  4: 0xf1c40f,  // Yellow
  5: 0x9b59b6,  // Purple
};

const OVERLAY_ALPHA = 0.15;

/**
 * TerritoryOverlay renders a semi-transparent color overlay
 * showing faction territory control on the map.
 */
export class TerritoryOverlay {
  private scene: Phaser.Scene;
  private overlayImage: Phaser.GameObjects.Image | null = null;
  private textureKey: string;
  private worldWidth: number;
  private worldHeight: number;
  private visible: boolean = false;

  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.scene = scene;
    this.textureKey = `__territory_overlay_${Date.now()}`;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Listen for territory updates
    eventBus.on('territory:updated', (data) => {
      this.renderOverlay(data.grid);
    });
  }

  private renderOverlay(grid: Uint8Array): void {
    // Remove existing overlay
    if (this.overlayImage) {
      this.overlayImage.destroy();
      const existing = this.scene.textures.get(this.textureKey);
      if (existing && existing.key !== '__MISSING') {
        this.scene.textures.remove(this.textureKey);
      }
    }

    const canvas = this.scene.textures.createCanvas(
      this.textureKey,
      this.worldWidth,
      this.worldHeight,
    );
    if (!canvas) return;

    const ctx = canvas.getContext();

    for (let y = 0; y < this.worldHeight; y++) {
      for (let x = 0; x < this.worldWidth; x++) {
        const factionId = grid[y * this.worldWidth + x];
        if (factionId > 0) {
          const color = FACTION_COLORS[factionId] ?? 0xffffff;
          ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
          ctx.globalAlpha = OVERLAY_ALPHA;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    ctx.globalAlpha = 1;
    canvas.refresh();

    const worldPxW = this.worldWidth * TILE_SIZE;
    const worldPxH = this.worldHeight * TILE_SIZE;

    this.overlayImage = this.scene.add.image(worldPxW / 2, worldPxH / 2, this.textureKey);
    this.overlayImage.setDisplaySize(worldPxW, worldPxH);
    this.overlayImage.setDepth(1); // Above terrain, below entities
    this.overlayImage.setVisible(this.visible);
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.overlayImage) {
      this.overlayImage.setVisible(this.visible);
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    if (this.overlayImage) {
      this.overlayImage.destroy();
    }
  }
}
