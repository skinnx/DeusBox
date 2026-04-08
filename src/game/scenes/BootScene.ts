import Phaser from 'phaser';
import { eventBus } from '@/core/EventBus.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    console.log('[BootScene] Booting DeusBox...');
    eventBus.emit('game:boot');
    this.scene.launch('Preloader');
  }
}
