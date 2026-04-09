import Phaser from 'phaser';
import { eventBus } from '@/core/EventBus.js';

interface Notification {
  container: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
  createdAt: number;
  duration: number;
}

const NOTIFICATION_DURATION = 4000;
const SLIDE_IN_DURATION = 300;
const MAX_NOTIFICATIONS = 5;
const NOTIFICATION_HEIGHT = 28;

const EVENT_COLORS: Record<string, string> = {
  'season:changed': '#f1c40f',
  'weather:changed': '#3498db',
  'diplomacy:changed': '#e74c3c',
  'war:declared': '#e74c3c',
  'war:ended': '#2ecc71',
  'research:completed': '#9b59b6',
  'trade:completed': '#f39c12',
  'storyteller:event': '#ecf0f1',
  'siege:start': '#e74c3c',
  'siege:end': '#2ecc71',
  'building:destroyed': '#e67e22',
};

const EVENT_LABELS: Record<string, string> = {
  'season:changed': 'Season',
  'weather:changed': 'Weather',
  'diplomacy:changed': 'Diplomacy',
  'war:declared': 'War',
  'war:ended': 'Peace',
  'research:completed': 'Research',
  'trade:completed': 'Trade',
  'storyteller:event': 'Story',
  'siege:start': 'Siege',
  'siege:end': 'Siege',
  'building:destroyed': 'Destroyed',
};

/**
 * NotificationSystem shows toast-style notifications for game events.
 * Appears at the top-right corner and auto-dismisses after a duration.
 */
export class NotificationSystem {
  private scene: Phaser.Scene;
  private notifications: Notification[] = [];
  private baseX: number;
  private baseY: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width } = scene.scale;
    this.baseX = width - 10;
    this.baseY = 70;

    // Listen to key events
    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('season:changed', (data) => {
      this.show(`${data.season}`, EVENT_COLORS['season:changed'] ?? '#ffffff');
    });

    eventBus.on('weather:changed', (data) => {
      this.show(`${data.weather} (intensity: ${data.intensity.toFixed(1)})`, EVENT_COLORS['weather:changed'] ?? '#ffffff');
    });

    eventBus.on('diplomacy:changed', (data) => {
      this.show(`F${data.factionA} & F${data.factionB}: ${data.newState}`, EVENT_COLORS['diplomacy:changed'] ?? '#ffffff');
    });

    eventBus.on('war:declared', (data) => {
      this.show(`War: F${data.attackerFaction} vs F${data.defenderFaction}`, EVENT_COLORS['war:declared'] ?? '#ffffff');
    });

    eventBus.on('war:ended', (data) => {
      this.show(`Peace: F${data.factionA} & F${data.factionB}`, EVENT_COLORS['war:ended'] ?? '#ffffff');
    });

    eventBus.on('research:completed', (data) => {
      this.show(`F${data.factionId} completed ${data.techId}`, EVENT_COLORS['research:completed'] ?? '#ffffff');
    });

    eventBus.on('building:destroyed', (data) => {
      this.show(`Building destroyed (F${data.factionId ?? '?'})`, EVENT_COLORS['building:destroyed'] ?? '#ffffff');
    });

    eventBus.on('storyteller:event', (data) => {
      this.show(`${data.type}`, EVENT_COLORS['storyteller:event'] ?? '#ffffff');
    });
  }

  show(message: string, color: string = '#ffffff'): void {
    // Remove oldest if at max
    if (this.notifications.length >= MAX_NOTIFICATIONS) {
      const oldest = this.notifications.shift();
      if (oldest) oldest.container.destroy();
    }

    const container = this.scene.add.container(this.baseX, this.baseY);
    container.setScrollFactor(0);
    container.setDepth(1500);
    container.setAlpha(0);

    // Background
    const bg = this.scene.add.rectangle(0, 0, 300, NOTIFICATION_HEIGHT, 0x000000, 0.7);
    bg.setOrigin(1, 0);
    bg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(color).color);
    container.add(bg);

    // Text
    const text = this.scene.add.text(-290, 6, message, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: color,
    });
    container.add(text);

    this.notifications.push({
      container,
      text,
      createdAt: this.scene.time.now,
      duration: NOTIFICATION_DURATION,
    });

    // Shift existing notifications down
    this.reposition();
  }

  private reposition(): void {
    for (let i = 0; i < this.notifications.length; i++) {
      const n = this.notifications[i]!;
      const targetY = this.baseY + i * (NOTIFICATION_HEIGHT + 4);
      n.container.setY(targetY);
    }
  }

  update(): void {
    const now = this.scene.time.now;

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const n = this.notifications[i]!;
      const elapsed = now - n.createdAt;
      const progress = elapsed / n.duration;

      // Slide in
      if (elapsed < SLIDE_IN_DURATION) {
        const slideProgress = elapsed / SLIDE_IN_DURATION;
        n.container.setAlpha(slideProgress);
        n.container.setX(this.baseX + (1 - slideProgress) * 50);
      } else {
        n.container.setAlpha(1);
        n.container.setX(this.baseX);
      }

      // Fade out in last 20%
      if (progress > 0.8) {
        n.container.setAlpha(1 - (progress - 0.8) / 0.2);
      }

      // Remove expired
      if (progress >= 1) {
        n.container.destroy();
        this.notifications.splice(i, 1);
        this.reposition();
      }
    }
  }

  destroy(): void {
    for (const n of this.notifications) {
      n.container.destroy();
    }
    this.notifications.length = 0;
  }
}
