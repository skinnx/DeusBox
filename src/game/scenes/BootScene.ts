import Phaser from 'phaser';
import { eventBus } from '@/core/EventBus.js';
import { errorHandler } from '@/core/ErrorHandler.js';
import { settings } from '@/core/Settings.js';
import { perfMonitor } from '@/core/PerformanceMonitor.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    console.log('[BootScene] Booting DeusBox v1.0.0...');

    this.checkWebGL();

    perfMonitor.setEnabled(settings.getGameplay().showFPS);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
    });

    eventBus.emit('game:boot');

    this.scene.launch('Preloader');
  }

  private checkWebGL(): void {
    const renderer = this.game.renderer;
    if (renderer.type === Phaser.CANVAS) {
      console.warn('[BootScene] WebGL not available, falling back to Canvas renderer. Performance may be reduced.');
    } else {
      const gl = (renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        console.log(`[BootScene] GPU: ${vendor} — ${gpu}`);
      }
      console.log(`[BootScene] Max texture size: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
    }
  }
}
