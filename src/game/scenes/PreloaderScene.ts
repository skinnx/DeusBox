import Phaser from 'phaser';
import { SpriteGenerator } from '@/game/sprites/SpriteGenerator.js';
import { AnimationGenerator } from '@/game/sprites/AnimationGenerator.js';
import { SceneTransition } from '@/ui/SceneTransition.js';

const ACCENT = 0xc9a227;
const BG_COLOR = 0x0a0a1a;

export class PreloaderScene extends Phaser.Scene {
  private progressBar: Phaser.GameObjects.Graphics | null = null;
  private progressBox: Phaser.GameObjects.Graphics | null = null;
  private loadingText: Phaser.GameObjects.Text | null = null;
  private percentText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private transition: SceneTransition | null = null;
  private currentStep = 0;
  private totalSteps = 6;

  constructor() {
    super('Preloader');
  }

  preload(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, BG_COLOR);

    const logoText = this.add.text(width / 2, height * 0.35, 'DEUSBOX', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#c9a227',
      stroke: '#000000',
      strokeThickness: 4,
    });
    logoText.setOrigin(0.5);
    logoText.setAlpha(0);
    this.tweens.add({ targets: logoText, alpha: 1, duration: 400 });

    const barWidth = 320;
    const barHeight = 8;
    const barX = width / 2 - barWidth / 2;
    const barY = height * 0.55;

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222233, 0.8);
    this.progressBox.fillRoundedRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
    this.progressBox.lineStyle(1, 0x333344);
    this.progressBox.strokeRoundedRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);

    this.progressBar = this.add.graphics();

    this.percentText = this.add.text(width / 2, barY + 24, '0%', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#c9a227',
    });
    this.percentText.setOrigin(0.5);

    this.statusText = this.add.text(width / 2, barY + 44, 'Initializing...', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#7f8c8d',
    });
    this.statusText.setOrigin(0.5);

    this.loadingText = this.add.text(width / 2, height * 0.85, 'Loading game assets', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#555555',
    });
    this.loadingText.setOrigin(0.5);

    const dots = this.add.text(width / 2 + 90, height * 0.85, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#555555',
    });
    this.time.addEvent({
      delay: 400,
      callback: () => {
        const d = dots.text.length >= 3 ? '' : dots.text + '.';
        dots.setText(d);
      },
      loop: true,
    });

    this.createPlaceholderTextures();
  }

  create(): void {
    this.transition = new SceneTransition(this);
    console.log('[PreloaderScene] All assets ready');
    this.updateProgress('Ready!', 1);

    this.time.delayedCall(300, async () => {
      if (this.transition) {
        await this.transition.fadeOut({ duration: 400 });
      }
      this.scene.stop('Preloader');
      this.scene.launch('MainMenu');
    });
  }

  private updateProgress(status: string, ratio?: number): void {
    this.currentStep++;
    const progress = ratio ?? this.currentStep / this.totalSteps;

    if (this.statusText) this.statusText.setText(status);
    if (this.percentText) this.percentText.setText(`${Math.round(progress * 100)}%`);

    if (this.progressBar) {
      const { width, height } = this.scale;
      const barWidth = 320;
      const barHeight = 8;
      const barX = width / 2 - barWidth / 2;
      const barY = height * 0.55;

      this.progressBar.clear();
      this.progressBar.fillStyle(ACCENT, 1);
      this.progressBar.fillRoundedRect(barX, barY, barWidth * progress, barHeight, 4);

      this.progressBar.fillStyle(0xffffff, 0.2);
      this.progressBar.fillRoundedRect(barX, barY, barWidth * progress, barHeight / 2, 2);
    }
  }

  private createPlaceholderTextures(): void {
    const gfx = this.add.graphics();

    this.updateProgress('Creating base textures');

    gfx.fillStyle(0xffffff);
    gfx.fillRect(0, 0, 1, 1);
    gfx.generateTexture('__white', 1, 1);
    gfx.clear();

    const tileColors: Record<string, number> = {
      deepWater: 0x1a5276,
      shallowWater: 0x2e86c1,
      sand: 0xf9e79f,
      grass: 0x82e0aa,
      forest: 0x27ae60,
      denseForest: 0x1e8449,
      mountain: 0x7f8c8d,
      snow: 0xecf0f1,
      desert: 0xf0b27a,
      tundra: 0xd5dbdb,
      lava: 0xe74c3c,
    };

    for (const [name, color] of Object.entries(tileColors)) {
      gfx.fillStyle(color);
      gfx.fillRect(0, 0, 32, 32);
      gfx.generateTexture(`tile_${name}`, 32, 32);
      gfx.clear();
    }

    this.updateProgress('Generating entity textures');

    const entityColors: Record<string, number> = {
      human: 0xe74c3c,
      elf: 0x2ecc71,
      dwarf: 0xe67e22,
      orc: 0x8e44ad,
      wolf: 0x7f8c8d,
      deer: 0xa0522d,
      chicken: 0xf1c40f,
      bear: 0x5d4e37,
      fish: 0x3498db,
    };

    for (const [name, color] of Object.entries(entityColors)) {
      gfx.fillStyle(color);
      gfx.fillRect(0, 0, 16, 16);
      gfx.generateTexture(`entity_${name}`, 16, 16);
      gfx.clear();
    }

    this.updateProgress('Creating building textures');

    const buildingColors: Record<string, number> = {
      house: 0xc0392b,
      farm: 0xf39c12,
      warehouse: 0x95a5a6,
      barracks: 0x7f8c8d,
      temple: 0x9b59b6,
      wall: 0x5d6d7e,
      road: 0xd4a574,
    };

    for (const [name, color] of Object.entries(buildingColors)) {
      gfx.fillStyle(color);
      gfx.fillRect(0, 0, 32, 32);
      gfx.generateTexture(`building_${name}`, 32, 32);
      gfx.clear();
    }

    gfx.destroy();

    this.updateProgress('Generating pixel art sprites');
    SpriteGenerator.generateCreatureSprites(this);
    SpriteGenerator.generateBuildingSprites(this);
    SpriteGenerator.generateEquipmentOverlays(this);

    this.updateProgress('Creating animations');
    AnimationGenerator.generateCreatureAnimations(this);
  }
}
