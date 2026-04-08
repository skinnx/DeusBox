import { gameConfig } from './game/GameConfig.js';

window.addEventListener('DOMContentLoaded', () => {
  new Phaser.Game(gameConfig);
  console.log('DeusBox initialized');
});
