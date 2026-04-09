import Phaser from 'phaser';
import { SceneTransition } from '@/ui/SceneTransition.js';

interface CreditSection {
  title: string;
  entries: string[];
}

const CREDITS: CreditSection[] = [
  { title: 'DEUSBOX', entries: ['God Simulator'] },
  { title: 'DESIGN & DEVELOPMENT', entries: ['Tâm Doãn Bắc'] },
  { title: 'ENGINE', entries: ['Phaser 3', 'bitecs ECS Framework'] },
  { title: 'PROCEDURAL GENERATION', entries: ['simplex-noise', 'Procedural Pixel Art', 'Generative Audio'] },
  { title: 'SYSTEMS', entries: [
    'AI Behavior Trees',
    'Combat & Military',
    'Diplomacy & Territory',
    'Economy & Trade',
    'Research & Technology',
    'Weather & Seasons',
    'God Powers & Disasters',
  ]},
  { title: 'TOOLS', entries: ['TypeScript', 'Vite', 'Web Audio API'] },
  { title: 'SPECIAL THANKS', entries: ['The Open Source Community', 'You, the Player'] },
];

const SCROLL_SPEED = 30;

export class CreditsScene extends Phaser.Scene {
  private transition: SceneTransition | null = null;
  private scrollContainer: Phaser.GameObjects.Container | null = null;
  private totalHeight = 0;

  constructor() {
    super('Credits');
  }

  create(): void {
    this.transition = new SceneTransition(this);
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a);

    for (let i = 0; i < 80; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const star = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.2, 0.6));
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.05, 0.3),
        duration: Phaser.Math.Between(1500, 4000),
        yoyo: true,
        repeat: -1,
      });
    }

    this.scrollContainer = this.add.container(width / 2, height);

    let y = 0;
    for (const section of CREDITS) {
      const title = this.add.text(0, y, section.title, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f1c40f',
        stroke: '#000000',
        strokeThickness: 2,
      });
      title.setOrigin(0.5, 0);
      this.scrollContainer.add(title);
      y += 36;

      for (const entry of section.entries) {
        const text = this.add.text(0, y, entry, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ecf0f1',
        });
        text.setOrigin(0.5, 0);
        this.scrollContainer.add(text);
        y += 24;
      }

      y += 32;
    }

    const versionText = this.add.text(0, y + 20, 'v1.0.0', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#7f8c8d',
    });
    versionText.setOrigin(0.5, 0);
    this.scrollContainer.add(versionText);

    this.totalHeight = y + 80;

    const skipText = this.add.text(width - 20, height - 20, 'Press any key or click to skip', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#555555',
    });
    skipText.setOrigin(1, 1);

    this.input.once('pointerdown', () => this.goBack());
    this.input.keyboard?.once('keydown', () => this.goBack());

    this.transition.fadeIn({ duration: 500 });
  }

  update(_time: number, delta: number): void {
    if (!this.scrollContainer) return;

    this.scrollContainer.y -= (SCROLL_SPEED * delta) / 1000;

    if (this.scrollContainer.y < -this.totalHeight) {
      this.goBack();
    }
  }

  private async goBack(): Promise<void> {
    if (this.transition) {
      await this.transition.fadeOut({ duration: 300 });
    }
    this.scene.stop('Credits');
    this.scene.launch('MainMenu');
  }
}
