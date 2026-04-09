import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { PreloaderScene } from './scenes/PreloaderScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { CreditsScene } from './scenes/CreditsScene.js';
import { settings } from '@/core/Settings.js';

const gfx = settings.getGraphics();

const fpsConfig = gfx.maxFPS > 0 ? { target: gfx.maxFPS, forceSetTimeOut: false } : {};

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: 1280,
  height: 720,
  parent: 'game-container',
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#0a0a1a',
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: fpsConfig,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  render: {
    antialias: gfx.antiAlias,
    powerPreference: 'high-performance',
    batchSize: 4096,
    maxLights: 10,
    maxTextures: -1,
  },
  audio: {
    disableWebAudio: false,
  },
  scene: [BootScene, PreloaderScene, MainMenuScene, GameScene, HUDScene, SettingsScene, CreditsScene],
};
