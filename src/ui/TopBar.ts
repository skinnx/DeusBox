import Phaser from 'phaser';
import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import Position from '@/game/ecs/components/Position.js';
import Faction from '@/game/ecs/components/Faction.js';
import { Creature } from '@/game/ecs/components/TagComponents.js';
import { Season, WeatherType, AIState } from '@/core/Types.js';
import { eventBus } from '@/core/EventBus.js';

const AI_STATE_NAMES: Record<string, string> = {
  [AIState.Idle]: 'Idle',
  [AIState.Wandering]: 'Wandering',
  [AIState.Seeking]: 'Seeking',
  [AIState.Working]: 'Working',
  [AIState.Fighting]: 'Fighting',
  [AIState.Fleeing]: 'Fleeing',
  [AIState.Resting]: 'Resting',
  [AIState.Eating]: 'Eating',
  [AIState.Socializing]: 'Socializing',
  [AIState.Dead]: 'Dead',
};

const SEASON_ICONS: Record<string, string> = {
  [Season.Spring]: 'SPR',
  [Season.Summer]: 'SUM',
  [Season.Autumn]: 'AUT',
  [Season.Winter]: 'WIN',
};

const WEATHER_ICONS: Record<string, string> = {
  [WeatherType.Clear]: 'CLR',
  [WeatherType.Rain]: 'RAN',
  [WeatherType.Storm]: 'STM',
  [WeatherType.Fog]: 'FOG',
  [WeatherType.Snow]: 'SNW',
};

export class TopBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private popText: Phaser.GameObjects.Text;
  private seasonText: Phaser.GameObjects.Text;
  private weatherText: Phaser.GameObjects.Text;
  private factionText: Phaser.GameObjects.Text;
  private frameCounter: number = 0;
  private updateInterval: number = 30;
  private currentSeason: Season = Season.Spring;
  private currentWeather: WeatherType = WeatherType.Clear;

  private onSeasonChanged = (data: { season: Season; previousSeason: Season }): void => {
    this.currentSeason = data.season;
    this.seasonText.setText(`Season: ${SEASON_ICONS[data.season] ?? data.season}`);
  };

  private onWeatherChanged = (data: { weather: WeatherType; intensity: number }): void => {
    this.currentWeather = data.weather;
    this.weatherText.setText(`Weather: ${WEATHER_ICONS[data.weather] ?? data.weather}`);
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width } = scene.scale;

    this.container = scene.add.container(10, 10);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    // Background panel
    this.background = scene.add.rectangle(0, 0, 320, 70, 0x000000, 0.7);
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(1, 0x333333);
    this.container.add(this.background);

    // Population text
    this.popText = scene.add.text(10, 6, 'Pop: 0', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2ecc71',
      fontStyle: 'bold',
    });
    this.container.add(this.popText);

    // Season text
    this.seasonText = scene.add.text(10, 24, `Season: ${SEASON_ICONS[this.currentSeason]}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f1c40f',
    });
    this.container.add(this.seasonText);

    // Weather text
    this.weatherText = scene.add.text(120, 24, `Weather: ${WEATHER_ICONS[this.currentWeather]}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#3498db',
    });
    this.container.add(this.weatherText);

    // Faction count text
    this.factionText = scene.add.text(10, 40, 'Factions: 0', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#95a5a6',
    });
    this.container.add(this.factionText);

    // Keyboard shortcut hint
    const hint = scene.add.text(10, 55, 'T: Territory | Space: Pause', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#555555',
    });
    this.container.add(hint);

    // Listen for season/weather changes
    eventBus.on('season:changed', this.onSeasonChanged);
    eventBus.on('weather:changed', this.onWeatherChanged);
  }

  update(world: GameWorld): void {
    this.frameCounter++;
    if (this.frameCounter % this.updateInterval !== 0) return;

    // Count creatures
    const creatures = query(world, [Position, Creature]);
    this.popText.setText(`Pop: ${creatures.length}`);

    // Count unique factions
    const factions = new Set<number>();
    for (let i = 0; i < creatures.length; i++) {
      if (hasComponent(world, creatures[i]!, Faction)) {
        factions.add(Math.floor(Faction.id[creatures[i]!]));
      }
    }
    this.factionText.setText(`Factions: ${factions.size}`);

    // Resize background
    this.background.setSize(320, 70);
  }

  static getAIStateName(stateValue: number): string {
    if (Number.isNaN(stateValue)) return 'Idle';
    const name = AI_STATE_NAMES[stateValue];
    if (name) return name;
    for (const [key, val] of Object.entries(AI_STATE_NAMES)) {
      if (key === String(stateValue)) return val;
    }
    return 'Unknown';
  }

  destroy(): void {
    eventBus.off('season:changed', this.onSeasonChanged);
    eventBus.off('weather:changed', this.onWeatherChanged);
    this.container.destroy();
  }
}
