import Phaser from 'phaser';

export class HUDScene extends Phaser.Scene {
  private pauseText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('HUD');
  }

  create(): void {
    console.log('[HUDScene] HUD initialized');

    // Prevent HUD from capturing game keyboard input
    this.input.keyboard!.enabled = false;

    const { width, height } = this.scale;

    // Debug text
    this.add.text(10, 10, 'HUD Active', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2ecc71',
    });

    // Pause button
    this.pauseText = this.add.text(width - 10, 10, '|| Pause', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ecf0f1',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.pauseText.setOrigin(1, 0);
    this.pauseText.setInteractive({ useHandCursor: true });

    this.pauseText.on('pointerover', () => {
      this.pauseText!.setColor('#f1c40f');
    });

    this.pauseText.on('pointerout', () => {
      this.pauseText!.setColor('#ecf0f1');
    });

    this.pauseText.on('pointerdown', () => {
      const gameScene = this.scene.get('Game');
      if (gameScene.scene.isPaused('Game')) {
        gameScene.scene.resume('Game');
        this.pauseText!.setText('|| Pause');
      } else {
        gameScene.scene.pause('Game');
        this.pauseText!.setText('> Resume');
      }
    });

    // FPS counter
    const fpsText = this.add.text(10, 30, 'FPS: --', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#95a5a6',
    });

    this.events.on('update', () => {
      const game = this.game;
      const fps = game.loop.actualFps;
      fpsText.setText(`FPS: ${Math.round(fps)}`);
    });
  }
}
