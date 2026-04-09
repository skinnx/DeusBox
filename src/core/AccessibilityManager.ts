import Phaser from 'phaser';
import { settings } from '@/core/Settings.js';

type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export class AccessibilityManager {
  private static instance: AccessibilityManager | null = null;
  private currentMode: ColorBlindMode = 'none';

  static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager();
    }
    return AccessibilityManager.instance;
  }

  init(_game: Phaser.Game): void {
    this.currentMode = settings.getAccessibility().colorBlindMode;
  }

  getColorBlindMode(): ColorBlindMode {
    return this.currentMode;
  }

  setColorBlindMode(mode: ColorBlindMode): void {
    this.currentMode = mode;
    settings.update({ accessibility: { colorBlindMode: mode } });
  }

  getTextScale(): number {
    return settings.getAccessibility().largeText ? 1.3 : 1.0;
  }

  shouldReduceMotion(): boolean {
    return settings.getAccessibility().reducedMotion;
  }

  canShakeScreen(): boolean {
    return settings.getAccessibility().screenShake;
  }

  isHighContrast(): boolean {
    return settings.getAccessibility().highContrast;
  }

  adjustColor(color: number): number {
    if (this.currentMode === 'none') return color;

    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    let nr = r, ng = g, nb = b;

    switch (this.currentMode) {
      case 'protanopia':
        nr = Math.round(0.567 * r + 0.433 * g);
        ng = Math.round(0.558 * r + 0.442 * g);
        nb = Math.round(0.242 * g + 0.758 * b);
        break;
      case 'deuteranopia':
        nr = Math.round(0.625 * r + 0.375 * g);
        ng = Math.round(0.7 * r + 0.3 * g);
        nb = Math.round(0.3 * g + 0.7 * b);
        break;
      case 'tritanopia':
        nr = Math.round(0.95 * r + 0.05 * g);
        ng = Math.round(0.433 * g + 0.567 * b);
        nb = Math.round(0.475 * g + 0.525 * b);
        break;
    }

    nr = Math.min(255, Math.max(0, nr));
    ng = Math.min(255, Math.max(0, ng));
    nb = Math.min(255, Math.max(0, nb));

    return (nr << 16) | (ng << 8) | nb;
  }
}

export const accessibility = AccessibilityManager.getInstance();
