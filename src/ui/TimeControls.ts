import Phaser from 'phaser';
import { SPEED_MULTIPLIERS } from '@/core/Constants.js';
import { Season, WeatherType } from '@/core/Types.js';
import { eventBus } from '@/core/EventBus.js';

const SEASON_SHORT: Record<string, string> = {
  [Season.Spring]: 'SPR',
  [Season.Summer]: 'SUM',
  [Season.Autumn]: 'AUT',
  [Season.Winter]: 'WIN',
};

const WEATHER_SHORT: Record<string, string> = {
  [WeatherType.Clear]: 'CLR',
  [WeatherType.Rain]: 'RAN',
  [WeatherType.Storm]: 'STM',
  [WeatherType.Fog]: 'FOG',
  [WeatherType.Snow]: 'SNW',
};

interface SpeedButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  multiplier: number;
}

export class TimeControls {
  private scene: Phaser.Scene;
  private speedMultiplier: number = 1;
  private container: Phaser.GameObjects.Container;
  private buttons: SpeedButton[] = [];
  private timeText: Phaser.GameObjects.Text;
  private dateText: Phaser.GameObjects.Text;
  private gameTime: number = 0;
  private onSpeedChange: (multiplier: number) => void;
  private background: Phaser.GameObjects.Rectangle;
  private seasonWeatherText: Phaser.GameObjects.Text;
  private currentSeason: Season = Season.Spring;
  private currentWeather: WeatherType = WeatherType.Clear;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onSpeedChange: (multiplier: number) => void,
  ) {
    this.scene = scene;
    this.onSpeedChange = onSpeedChange;

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    // Background panel
    this.background = scene.add.rectangle(0, 0, 280, 36, 0x000000, 0.6);
    this.background.setOrigin(0.5, 0.5);
    this.container.add(this.background);

    // Speed buttons
    const labels: Array<{ text: string; speed: number }> = [
      { text: '\u25AE\u25AE', speed: 0 },
      { text: '\u25B7 1x', speed: 1 },
      { text: '\u25B7\u25B7 2x', speed: 2 },
      { text: '\u25B7\u25B7\u25B7 4x', speed: 4 },
    ];

    const buttonWidth = 52;
    const totalWidth = labels.length * buttonWidth + 80;
    let bx = -totalWidth / 2 + buttonWidth / 2;

    for (const { text, speed } of labels) {
      const btnContainer = scene.add.container(bx, 0);
      btnContainer.setScrollFactor(0);

      const bg = scene.add.rectangle(0, 0, buttonWidth - 4, 28, 0x333333, 0.8);
      bg.setOrigin(0.5, 0.5);
      bg.setStrokeStyle(speed === this.speedMultiplier ? 2 : 0, 0xf1c40f);

      const label = scene.add.text(0, 0, text, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ecf0f1',
      });
      label.setOrigin(0.5, 0.5);

      btnContainer.add([bg, label]);
      btnContainer.setSize(buttonWidth - 4, 28);
      btnContainer.setInteractive({ useHandCursor: true });

      btnContainer.on('pointerdown', () => {
        this.setSpeed(speed);
      });

      btnContainer.on('pointerover', () => {
        bg.setFillStyle(0x555555, 0.9);
      });

      btnContainer.on('pointerout', () => {
        const isActive = this.speedMultiplier === speed;
        bg.setFillStyle(isActive ? 0x444444 : 0x333333, 0.8);
      });

      this.buttons.push({ container: btnContainer, bg, label, multiplier: speed });
      this.container.add(btnContainer);

      bx += buttonWidth;
    }

    // Game time display
    const timeX = bx + 20;
    this.dateText = scene.add.text(timeX, -6, 'Day 1', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#95a5a6',
    });
    this.dateText.setOrigin(0, 0.5);

    this.timeText = scene.add.text(timeX, 6, '00:00', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#95a5a6',
    });
    this.timeText.setOrigin(0, 0.5);

    this.container.add([this.dateText, this.timeText]);

    // Season + Weather text (below date/time)
    this.seasonWeatherText = scene.add.text(timeX, -16, 'SPR | CLR', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#f39c12',
    });
    this.seasonWeatherText.setOrigin(0, 0.5);
    this.container.add(this.seasonWeatherText);

    // Listen for season/weather changes
    eventBus.on('season:changed', (data: { season: Season }) => {
      this.currentSeason = data.season;
      this.updateSeasonWeather();
    });
    eventBus.on('weather:changed', (data: { weather: WeatherType }) => {
      this.currentWeather = data.weather;
      this.updateSeasonWeather();
    });

    this.updateButtonHighlights();
  }

  setSpeed(multiplier: number): void {
    if (!SPEED_MULTIPLIERS.includes(multiplier as (typeof SPEED_MULTIPLIERS)[number])) {
      return;
    }
    this.speedMultiplier = multiplier;
    this.updateButtonHighlights();
    this.onSpeedChange(multiplier);
  }

  getSpeed(): number {
    return this.speedMultiplier;
  }

  update(delta: number): void {
    this.gameTime += delta * this.speedMultiplier;
    this.updateTimeDisplay();
  }

  private updateTimeDisplay(): void {
    // 1 real second = 1 game minute
    const totalMinutes = Math.floor(this.gameTime / 1000);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const day = Math.floor(totalMinutes / 1440) + 1;

    this.dateText.setText(`Day ${day}`);
    this.timeText.setText(
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
    );
  }

  private updateButtonHighlights(): void {
    for (const btn of this.buttons) {
      const isActive = btn.multiplier === this.speedMultiplier;
      if (isActive) {
        btn.bg.setFillStyle(0x444444, 0.9);
        btn.bg.setStrokeStyle(2, 0xf1c40f);
        btn.label.setColor('#f1c40f');
      } else {
        btn.bg.setFillStyle(0x333333, 0.8);
        btn.bg.setStrokeStyle(0, 0x000000);
        btn.label.setColor('#ecf0f1');
      }
    }
  }

  private updateSeasonWeather(): void {
    const s = SEASON_SHORT[this.currentSeason] ?? '???';
    const w = WEATHER_SHORT[this.currentWeather] ?? '???';
    this.seasonWeatherText.setText(`${s} | ${w}`);
  }

  destroy(): void {
    this.container.destroy();
  }
}
