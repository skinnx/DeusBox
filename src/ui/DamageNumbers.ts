import Phaser from 'phaser';
import { eventBus } from '@/core/EventBus.js';

interface FloatingText {
  text: Phaser.GameObjects.Text;
  createdAt: number;
  duration: number;
  startY: number;
}

const DURATION = 1200;
const RISE_SPEED = 40;
const MAX_DAMAGE_NUMBERS = 30;

/**
 * DamageNumbers displays floating damage/heal numbers at entity positions.
 * Listens to 'damage:dealt' events from EventBus.
 */
export class DamageNumbers {
  private scene: Phaser.Scene;
  private active: FloatingText[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    eventBus.on('damage:dealt', (data: { entityId: number; amount: number; source: string }) => {
      this.spawn(data.amount, data.source);
    });
  }

  /**
   * Spawn a floating number at world position derived from the source context.
   * For direct positional spawning, use spawnAt().
   */
  spawn(amount: number, _source: string): void {
    // We don't have entity position here directly,
    // use spawnAt from CombatSystem instead
  }

  /**
   * Spawn a floating damage/heal number at a specific world position.
   */
  spawnAt(x: number, y: number, amount: number, color: string = '#ff4444'): void {
    if (this.active.length >= MAX_DAMAGE_NUMBERS) {
      const oldest = this.active.shift();
      if (oldest) oldest.text.destroy();
    }

    const prefix = amount >= 0 ? '-' : '+';
    const displayColor = amount >= 0 ? color : '#44ff44';

    const text = this.scene.add.text(x, y, `${prefix}${Math.abs(Math.round(amount))}`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: displayColor,
      stroke: '#000000',
      strokeThickness: 2,
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(2000);

    this.active.push({
      text,
      createdAt: this.scene.time.now,
      duration: DURATION,
      startY: y,
    });
  }

  update(): void {
    const now = this.scene.time.now;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const ft = this.active[i]!;
      const elapsed = now - ft.createdAt;
      const progress = elapsed / ft.duration;

      if (progress >= 1) {
        ft.text.destroy();
        this.active.splice(i, 1);
        continue;
      }

      // Rise upward
      const newY = ft.startY - RISE_SPEED * progress;
      ft.text.setY(newY);

      // Fade out in last 30%
      if (progress > 0.7) {
        ft.text.setAlpha(1 - (progress - 0.7) / 0.3);
      }
    }
  }

  destroy(): void {
    for (const ft of this.active) {
      ft.text.destroy();
    }
    this.active.length = 0;
  }
}
