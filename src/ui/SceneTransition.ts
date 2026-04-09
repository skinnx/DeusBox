import Phaser from 'phaser';

export type TransitionType = 'fade' | 'wipe' | 'dissolve' | 'zoom';

interface TransitionConfig {
  duration?: number;
  color?: number;
  type?: TransitionType;
  onComplete?: () => void;
}

const DEFAULT_DURATION = 500;
const DEFAULT_COLOR = 0x000000;

export class SceneTransition {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private transitioning = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  fadeOut(config: TransitionConfig = {}): Promise<void> {
    if (this.transitioning) return Promise.resolve();
    this.transitioning = true;

    const duration = config.duration ?? DEFAULT_DURATION;
    const color = config.color ?? DEFAULT_COLOR;
    const { width, height } = this.scene.scale;

    return new Promise((resolve) => {
      this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, color, 0);
      this.overlay.setScrollFactor(0);
      this.overlay.setDepth(10000);

      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 1,
        duration,
        ease: 'Power2',
        onComplete: () => {
          this.transitioning = false;
          config.onComplete?.();
          resolve();
        },
      });
    });
  }

  fadeIn(config: TransitionConfig = {}): Promise<void> {
    if (this.transitioning) return Promise.resolve();
    this.transitioning = true;

    const duration = config.duration ?? DEFAULT_DURATION;
    const color = config.color ?? DEFAULT_COLOR;
    const { width, height } = this.scene.scale;

    return new Promise((resolve) => {
      this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, color, 1);
      this.overlay.setScrollFactor(0);
      this.overlay.setDepth(10000);

      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration,
        ease: 'Power2',
        onComplete: () => {
          this.transitioning = false;
          if (this.overlay) {
            this.overlay.destroy();
            this.overlay = null;
          }
          config.onComplete?.();
          resolve();
        },
      });
    });
  }

  async crossFade(targetScene: string, config: TransitionConfig = {}): Promise<void> {
    await this.fadeOut({ ...config, duration: (config.duration ?? DEFAULT_DURATION) / 2 });
    this.scene.scene.stop();
    this.scene.scene.launch(targetScene);
    await this.fadeIn({ ...config, duration: (config.duration ?? DEFAULT_DURATION) / 2 });
  }

  isTransitioning(): boolean {
    return this.transitioning;
  }

  destroy(): void {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
  }
}
