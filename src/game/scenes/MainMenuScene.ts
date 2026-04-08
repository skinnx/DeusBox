import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width, height } = this.scale;

    // Title
    const title = this.add.text(width / 2, height * 0.3, 'DEUSBOX', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 4,
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(width / 2, height * 0.3 + 80, 'God Simulator', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ecf0f1',
      stroke: '#000000',
      strokeThickness: 2,
    });
    subtitle.setOrigin(0.5);

    // Start button
    const startButton = this.add.text(width / 2, height * 0.6, '[ Start Game ]', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    startButton.setOrigin(0.5);
    startButton.setInteractive({ useHandCursor: true });

    startButton.on('pointerover', () => {
      startButton.setColor('#f1c40f');
    });

    startButton.on('pointerout', () => {
      startButton.setColor('#ffffff');
    });

    startButton.on('pointerdown', () => {
      this.scene.stop('MainMenu');
      this.scene.launch('Game');
      this.scene.launch('HUD');
    });

    // Version
    const version = this.add.text(width - 10, height - 10, 'v0.1.0', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#7f8c8d',
    });
    version.setOrigin(1, 1);

    // Decorative stars
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const star = this.add.circle(
        x,
        y,
        Phaser.Math.Between(1, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.3, 0.8),
      );
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.1, 0.4),
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1,
      });
    }
  }
}
