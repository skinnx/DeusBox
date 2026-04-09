import { gameConfig } from './game/GameConfig.js';
import { errorHandler } from './core/ErrorHandler.js';
import { settings } from './core/Settings.js';

function onCriticalError(): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; background: #0a0a1a; z-index: 99999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: monospace; color: #ecf0f1;
  `;
  overlay.innerHTML = `
    <h2 style="color: #e74c3c; margin-bottom: 16px;">DeusBox — Critical Error</h2>
    <p style="color: #95a5a6; margin-bottom: 24px;">The game encountered a fatal error and needs to restart.</p>
    <p style="color: #7f8c8d; font-size: 12px; margin-bottom: 24px;">Your progress has been auto-saved.</p>
    <button onclick="location.reload()" style="
      background: #c9a227; color: #0a0a1a; border: none; padding: 12px 32px;
      font-family: monospace; font-size: 16px; cursor: pointer; border-radius: 4px;
    ">Restart Game</button>
  `;
  document.body.appendChild(overlay);
}

function showLoadingIndicator(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'boot-loader';
  el.style.cssText = `
    position: fixed; inset: 0; background: #0a0a1a; z-index: 10000;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: monospace; transition: opacity 0.4s;
  `;
  el.innerHTML = `
    <div style="color: #c9a227; font-size: 36px; letter-spacing: 4px; margin-bottom: 16px;">DEUSBOX</div>
    <div style="width: 200px; height: 3px; background: #222233; border-radius: 2px; overflow: hidden;">
      <div style="width: 30%; height: 100%; background: #c9a227; animation: loadbar 1.2s ease-in-out infinite;"></div>
    </div>
    <style>@keyframes loadbar { 0% { width: 0%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }</style>
  `;
  document.body.appendChild(el);
  return el;
}

window.addEventListener('DOMContentLoaded', () => {
  errorHandler.init(onCriticalError);

  const loader = showLoadingIndicator();

  try {
    const game = new Phaser.Game(gameConfig);

    game.events.once('ready', () => {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 400);
    });

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        game.destroy(true);
      });
    }

    (window as unknown as { __DEUSBOX_GAME__: Phaser.Game }).__DEUSBOX_GAME__ = game;

    console.log(
      '%c🎮 DeusBox v1.0.0 %c— God Simulator',
      'color: #c9a227; font-size: 14px; font-weight: bold;',
      'color: #95a5a6; font-size: 12px;'
    );
  } catch (err) {
    errorHandler.handleError(err instanceof Error ? err : new Error(String(err)), 'game:init');
    loader.remove();
    onCriticalError();
  }
});
