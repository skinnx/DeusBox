import Phaser from 'phaser';
import { SceneTransition } from '@/ui/SceneTransition.js';
import { SaveManager } from '@/game/save/SaveManager.js';
import { AudioManager } from '@/game/audio/AudioManager.js';
import { AmbientMusicGenerator } from '@/game/audio/AmbientMusicGenerator.js';
import { settings } from '@/core/Settings.js';

const ACCENT = 0xc9a227;
const ACCENT_CSS = '#c9a227';
const TEXT_PRIMARY = '#ecf0f1';
const TEXT_DIM = '#7f8c8d';
const BG_COLOR = 0x0a0a1a;

interface MenuButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  enabled: boolean;
}

export class MainMenuScene extends Phaser.Scene {
  private transition: SceneTransition | null = null;
  private buttons: MenuButton[] = [];
  private audioManager: AudioManager;
  private ambientMusic: AmbientMusicGenerator;
  private musicInitialized = false;
  private titleText: Phaser.GameObjects.Text | null = null;
  private subtitleText: Phaser.GameObjects.Text | null = null;
  private particles: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('MainMenu');
    this.audioManager = AudioManager.getInstance();
    this.ambientMusic = new AmbientMusicGenerator();
  }

  create(): void {
    this.transition = new SceneTransition(this);
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, BG_COLOR);

    this.createStarfield(width, height);
    this.createNebulaEffect(width, height);
    this.createTitle(width, height);
    this.createMenuButtons(width, height);
    this.createFooter(width, height);

    this.input.once('pointerdown', () => {
      this.audioManager.init();
      if (!this.musicInitialized && this.audioManager.isEnabled()) {
        this.musicInitialized = true;
        try {
          const ctx = new AudioContext();
          this.ambientMusic.init(ctx);
          this.ambientMusic.setMood('peaceful');
          this.ambientMusic.start();
        } catch {
          // audio not available
        }
      }
    });

    this.transition.fadeIn({ duration: 600 });
  }

  private createStarfield(width: number, height: number): void {
    const layers = [
      { count: 60, sizeRange: [1, 1] as [number, number], alphaRange: [0.15, 0.4] as [number, number], speed: [2000, 5000] as [number, number] },
      { count: 30, sizeRange: [1, 2] as [number, number], alphaRange: [0.3, 0.7] as [number, number], speed: [1500, 3500] as [number, number] },
      { count: 15, sizeRange: [2, 3] as [number, number], alphaRange: [0.5, 0.9] as [number, number], speed: [1000, 2500] as [number, number] },
    ];

    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        const x = Phaser.Math.Between(0, width);
        const y = Phaser.Math.Between(0, height);
        const size = Phaser.Math.Between(layer.sizeRange[0], layer.sizeRange[1]);
        const alpha = Phaser.Math.FloatBetween(layer.alphaRange[0], layer.alphaRange[1]);

        const star = this.add.circle(x, y, size, 0xffffff, alpha);

        this.tweens.add({
          targets: star,
          alpha: { from: alpha, to: alpha * 0.2 },
          duration: Phaser.Math.Between(layer.speed[0], layer.speed[1]),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  private createNebulaEffect(width: number, height: number): void {
    const gfx = this.add.graphics();
    gfx.setAlpha(0.08);

    const colors = [0x3498db, 0x9b59b6, 0xe74c3c, 0x2ecc71];
    for (let i = 0; i < 4; i++) {
      const cx = Phaser.Math.Between(width * 0.2, width * 0.8);
      const cy = Phaser.Math.Between(height * 0.2, height * 0.8);
      const r = Phaser.Math.Between(100, 250);
      gfx.fillStyle(colors[i]!, 0.3);
      gfx.fillCircle(cx, cy, r);
    }

    this.tweens.add({
      targets: gfx,
      alpha: { from: 0.05, to: 0.12 },
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createTitle(width: number, height: number): void {
    this.titleText = this.add.text(width / 2, height * 0.18, 'DEUSBOX', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: ACCENT_CSS,
      stroke: '#000000',
      strokeThickness: 6,
    });
    this.titleText.setOrigin(0.5);
    this.titleText.setAlpha(0);

    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      y: height * 0.2,
      duration: 800,
      ease: 'Back.easeOut',
    });

    this.subtitleText = this.add.text(width / 2, height * 0.2 + 70, 'G O D   S I M U L A T O R', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: TEXT_DIM,
      letterSpacing: 4,
    });
    this.subtitleText.setOrigin(0.5);
    this.subtitleText.setAlpha(0);

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 0.8,
      duration: 1200,
      delay: 400,
    });

    const dividerY = height * 0.2 + 100;
    const divider = this.add.graphics();
    divider.lineStyle(1, ACCENT, 0.3);
    divider.lineBetween(width / 2 - 120, dividerY, width / 2 + 120, dividerY);
    divider.setAlpha(0);

    this.tweens.add({
      targets: divider,
      alpha: 1,
      duration: 800,
      delay: 600,
    });
  }

  private createMenuButtons(width: number, height: number): void {
    const hasSave = SaveManager.hasSave(1) || SaveManager.hasSave(2) || SaveManager.hasSave(3);

    const menuItems = [
      { label: 'NEW GAME', action: () => this.startNewGame(), enabled: true },
      { label: 'CONTINUE', action: () => this.continueGame(), enabled: hasSave },
      { label: 'SETTINGS', action: () => this.openSettings(), enabled: true },
      { label: 'CREDITS', action: () => this.openCredits(), enabled: true },
    ];

    const startY = height * 0.45;
    const spacing = 50;

    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i]!;
      const y = startY + i * spacing;

      const container = this.add.container(width / 2, y);
      container.setAlpha(0);

      const bg = this.add.rectangle(0, 0, 260, 38, 0x000000, 0);
      bg.setStrokeStyle(0, ACCENT);
      container.add(bg);

      const label = this.add.text(0, 0, item.label, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: item.enabled ? TEXT_PRIMARY : '#444444',
        letterSpacing: 2,
      });
      label.setOrigin(0.5);
      container.add(label);

      if (item.enabled) {
        container.setSize(260, 38);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerover', () => {
          label.setColor(ACCENT_CSS);
          bg.setStrokeStyle(1, ACCENT, 0.5);
          bg.setFillStyle(0xffffff, 0.03);
          this.audioManager.playButtonHover();
        });

        container.on('pointerout', () => {
          label.setColor(TEXT_PRIMARY);
          bg.setStrokeStyle(0, ACCENT);
          bg.setFillStyle(0x000000, 0);
        });

        container.on('pointerdown', () => {
          this.audioManager.playUIClick();
          item.action();
        });
      }

      this.tweens.add({
        targets: container,
        alpha: 1,
        y: y,
        duration: 400,
        delay: 800 + i * 100,
        ease: 'Power2',
      });

      this.buttons.push({ container, bg, label, enabled: item.enabled });
    }
  }

  private createFooter(width: number, height: number): void {
    const version = this.add.text(width - 16, height - 16, 'v1.0.0', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#444444',
    });
    version.setOrigin(1, 1);

    const copyright = this.add.text(16, height - 16, '© 2026 DeusBox', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#444444',
    });
    copyright.setOrigin(0, 1);

    const tips = [
      'Use god powers to shape the world',
      'Creatures form factions and wage wars',
      'Build, trade, research — or destroy everything',
      'Right-click entities for context actions',
      'Press F5 to quick save, F9 to quick load',
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)]!;

    const tipText = this.add.text(width / 2, height - 16, tip, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#555555',
      fontStyle: 'italic',
    });
    tipText.setOrigin(0.5, 1);
  }

  private async startNewGame(): Promise<void> {
    this.ambientMusic.stop();
    if (this.transition) {
      await this.transition.fadeOut({ duration: 400 });
    }
    this.scene.stop('MainMenu');
    this.scene.launch('Game');
    this.scene.launch('HUD');
  }

  private async continueGame(): Promise<void> {
    this.ambientMusic.stop();
    if (this.transition) {
      await this.transition.fadeOut({ duration: 400 });
    }
    this.scene.stop('MainMenu');
    this.scene.launch('Game', { loadSlot: 1 });
    this.scene.launch('HUD');
  }

  private async openSettings(): Promise<void> {
    if (this.transition) {
      await this.transition.fadeOut({ duration: 200 });
    }
    this.scene.stop('MainMenu');
    this.scene.launch('Settings', { returnTo: 'MainMenu' });
  }

  private async openCredits(): Promise<void> {
    if (this.transition) {
      await this.transition.fadeOut({ duration: 300 });
    }
    this.scene.stop('MainMenu');
    this.scene.launch('Credits');
  }

  shutdown(): void {
    this.ambientMusic.stop();
    this.ambientMusic.destroy();
    this.buttons = [];
  }
}
