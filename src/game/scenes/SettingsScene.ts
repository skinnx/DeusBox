import Phaser from 'phaser';
import { settings, type GameSettings, type PartialGameSettings } from '@/core/Settings.js';
import { SceneTransition } from '@/ui/SceneTransition.js';

type SettingsTab = 'graphics' | 'audio' | 'gameplay' | 'accessibility' | 'controls';

const TAB_ORDER: SettingsTab[] = ['graphics', 'audio', 'gameplay', 'accessibility', 'controls'];
const TAB_LABELS: Record<SettingsTab, string> = {
  graphics: 'GRAPHICS',
  audio: 'AUDIO',
  gameplay: 'GAMEPLAY',
  accessibility: 'ACCESS.',
  controls: 'CONTROLS',
};

const ACCENT = 0xc9a227;
const BG_DARK = 0x0a0a1a;
const PANEL_BG = 0x111122;

export class SettingsScene extends Phaser.Scene {
  private transition: SceneTransition | null = null;
  private activeTab: SettingsTab = 'graphics';
  private tabButtons: Phaser.GameObjects.Container[] = [];
  private contentContainer: Phaser.GameObjects.Container | null = null;
  private returnScene: string = 'MainMenu';

  constructor() {
    super('Settings');
  }

  init(data?: { returnTo?: string }): void {
    if (data?.returnTo) {
      this.returnScene = data.returnTo;
    }
  }

  create(): void {
    this.transition = new SceneTransition(this);
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, BG_DARK);

    const title = this.add.text(width / 2, 30, 'SETTINGS', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 2,
    });
    title.setOrigin(0.5);

    this.createTabs(width);
    this.createContent(width, height);

    const backBtn = this.add.text(40, height - 40, '< BACK', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ecf0f1',
    });
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#f1c40f'));
    backBtn.on('pointerout', () => backBtn.setColor('#ecf0f1'));
    backBtn.on('pointerdown', () => this.goBack());

    const resetBtn = this.add.text(width - 40, height - 40, 'RESET DEFAULTS', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e74c3c',
    });
    resetBtn.setOrigin(1, 0);
    resetBtn.setInteractive({ useHandCursor: true });
    resetBtn.on('pointerover', () => resetBtn.setColor('#ff6b6b'));
    resetBtn.on('pointerout', () => resetBtn.setColor('#e74c3c'));
    resetBtn.on('pointerdown', () => {
      settings.reset();
      this.refreshContent();
    });

    this.transition.fadeIn({ duration: 300 });
  }

  private createTabs(width: number): void {
    const tabWidth = 120;
    const totalWidth = TAB_ORDER.length * tabWidth;
    let x = (width - totalWidth) / 2 + tabWidth / 2;

    for (const tab of TAB_ORDER) {
      const container = this.add.container(x, 70);

      const bg = this.add.rectangle(0, 0, tabWidth - 4, 28, 0x222233, 0.9);
      bg.setStrokeStyle(this.activeTab === tab ? 2 : 0, ACCENT);

      const label = this.add.text(0, 0, TAB_LABELS[tab], {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: this.activeTab === tab ? '#f1c40f' : '#95a5a6',
      });
      label.setOrigin(0.5);

      container.add([bg, label]);
      container.setSize(tabWidth - 4, 28);
      container.setInteractive({ useHandCursor: true });

      container.on('pointerdown', () => {
        this.activeTab = tab;
        this.refreshTabs();
        this.refreshContent();
      });

      this.tabButtons.push(container);
      x += tabWidth;
    }
  }

  private refreshTabs(): void {
    for (let i = 0; i < TAB_ORDER.length; i++) {
      const tab = TAB_ORDER[i]!;
      const container = this.tabButtons[i]!;
      const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
      const label = container.getAt(1) as Phaser.GameObjects.Text;

      bg.setStrokeStyle(this.activeTab === tab ? 2 : 0, ACCENT);
      label.setColor(this.activeTab === tab ? '#f1c40f' : '#95a5a6');
    }
  }

  private createContent(width: number, height: number): void {
    if (this.contentContainer) {
      this.contentContainer.destroy();
    }

    this.contentContainer = this.add.container(0, 0);
    const panelX = width / 2;
    const panelY = 100;
    const panelW = 600;
    const panelH = height - 180;

    const bg = this.add.rectangle(panelX, panelY + panelH / 2, panelW, panelH, PANEL_BG, 0.9);
    bg.setStrokeStyle(1, 0x333344);
    this.contentContainer.add(bg);

    const startX = panelX - panelW / 2 + 30;
    let y = panelY + 20;

    switch (this.activeTab) {
      case 'graphics':
        y = this.buildGraphicsUI(startX, y, panelW - 60);
        break;
      case 'audio':
        y = this.buildAudioUI(startX, y, panelW - 60);
        break;
      case 'gameplay':
        y = this.buildGameplayUI(startX, y, panelW - 60);
        break;
      case 'accessibility':
        y = this.buildAccessibilityUI(startX, y, panelW - 60);
        break;
      case 'controls':
        y = this.buildControlsUI(startX, y, panelW - 60);
        break;
    }
  }

  private refreshContent(): void {
    const { width, height } = this.scale;
    this.createContent(width, height);
  }

  private addLabel(x: number, y: number, text: string): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ecf0f1',
    });
    this.contentContainer!.add(label);
    return label;
  }

  private addSlider(x: number, y: number, w: number, value: number, onChange: (v: number) => void): number {
    const trackBg = this.add.rectangle(x + w / 2, y + 8, w, 6, 0x333344);
    trackBg.setOrigin(0.5, 0.5);
    this.contentContainer!.add(trackBg);

    const fillW = value * w;
    const fill = this.add.rectangle(x + fillW / 2, y + 8, fillW, 6, ACCENT);
    fill.setOrigin(0.5, 0.5);
    this.contentContainer!.add(fill);

    const handle = this.add.circle(x + value * w, y + 8, 8, 0xffffff);
    handle.setInteractive({ draggable: true, useHandCursor: true });
    this.contentContainer!.add(handle);

    const valueText = this.add.text(x + w + 12, y + 2, `${Math.round(value * 100)}%`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#95a5a6',
    });
    this.contentContainer!.add(valueText);

    handle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const newX = Math.max(x, Math.min(x + w, dragX));
      handle.setX(newX);
      const newValue = (newX - x) / w;
      fill.setSize(newValue * w, 6);
      fill.setX(x + (newValue * w) / 2);
      valueText.setText(`${Math.round(newValue * 100)}%`);
      onChange(newValue);
    });

    return y + 24;
  }

  private addToggle(x: number, y: number, label: string, value: boolean, onChange: (v: boolean) => void): number {
    this.addLabel(x, y, label);

    const btnX = x + 320;
    const bg = this.add.rectangle(btnX, y + 8, 44, 20, value ? 0x2ecc71 : 0x555555, 0.8);
    bg.setStrokeStyle(1, 0x777777);
    this.contentContainer!.add(bg);

    const knob = this.add.circle(value ? btnX + 12 : btnX - 12, y + 8, 8, 0xffffff);
    this.contentContainer!.add(knob);

    const statusText = this.add.text(btnX + 30, y + 2, value ? 'ON' : 'OFF', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: value ? '#2ecc71' : '#e74c3c',
    });
    this.contentContainer!.add(statusText);

    bg.setInteractive({ useHandCursor: true });
    knob.setInteractive({ useHandCursor: true });

    const toggle = () => {
      const newVal = !value;
      value = newVal;
      bg.setFillStyle(newVal ? 0x2ecc71 : 0x555555, 0.8);
      knob.setX(newVal ? btnX + 12 : btnX - 12);
      statusText.setText(newVal ? 'ON' : 'OFF');
      statusText.setColor(newVal ? '#2ecc71' : '#e74c3c');
      onChange(newVal);
    };

    bg.on('pointerdown', toggle);
    knob.on('pointerdown', toggle);

    return y + 30;
  }

  private addDropdown(x: number, y: number, label: string, options: string[], current: string, onChange: (v: string) => void): number {
    this.addLabel(x, y, label);

    const btnX = x + 320;
    const bg = this.add.rectangle(btnX + 50, y + 8, 120, 22, 0x222233, 0.9);
    bg.setStrokeStyle(1, 0x555566);
    bg.setInteractive({ useHandCursor: true });
    this.contentContainer!.add(bg);

    const text = this.add.text(btnX + 50, y + 8, current.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f1c40f',
    });
    text.setOrigin(0.5);
    this.contentContainer!.add(text);

    bg.on('pointerdown', () => {
      const idx = options.indexOf(current);
      const next = options[(idx + 1) % options.length]!;
      current = next;
      text.setText(next.toUpperCase());
      onChange(next);
    });

    return y + 30;
  }

  private buildGraphicsUI(x: number, y: number, _w: number): number {
    const gfx = settings.getGraphics();

    y = this.addDropdown(x, y, 'Quality Preset', ['low', 'medium', 'high', 'ultra'], gfx.quality, (v) => {
      settings.update({ graphics: { quality: v as 'low' | 'medium' | 'high' | 'ultra' } });
    });
    y += 4;
    y = this.addToggle(x, y, 'Particles', gfx.particles, (v) => {
      settings.update({ graphics: { particles: v } });
    });
    y = this.addToggle(x, y, 'Day/Night Cycle', gfx.dayNightCycle, (v) => {
      settings.update({ graphics: { dayNightCycle: v } });
    });
    y = this.addToggle(x, y, 'Weather Effects', gfx.weatherEffects, (v) => {
      settings.update({ graphics: { weatherEffects: v } });
    });
    y = this.addToggle(x, y, 'Damage Numbers', gfx.damageNumbers, (v) => {
      settings.update({ graphics: { damageNumbers: v } });
    });
    y = this.addDropdown(x, y, 'Max FPS', ['30', '60', '120', '0'], String(gfx.maxFPS), (v) => {
      settings.update({ graphics: { maxFPS: Number(v) as 30 | 60 | 120 | 0 } });
    });

    return y;
  }

  private buildAudioUI(x: number, y: number, w: number): number {
    const audio = settings.getAudio();

    y = this.addToggle(x, y, 'Sound Enabled', audio.enabled, (v) => {
      settings.update({ audio: { enabled: v } });
    });
    y += 8;
    this.addLabel(x, y, 'Master Volume');
    y += 16;
    y = this.addSlider(x, y, Math.min(w - 80, 300), audio.master, (v) => {
      settings.update({ audio: { master: v } });
    });
    y += 8;
    this.addLabel(x, y, 'SFX Volume');
    y += 16;
    y = this.addSlider(x, y, Math.min(w - 80, 300), audio.sfx, (v) => {
      settings.update({ audio: { sfx: v } });
    });
    y += 8;
    this.addLabel(x, y, 'Music Volume');
    y += 16;
    y = this.addSlider(x, y, Math.min(w - 80, 300), audio.music, (v) => {
      settings.update({ audio: { music: v } });
    });
    y += 8;
    this.addLabel(x, y, 'Ambient Volume');
    y += 16;
    y = this.addSlider(x, y, Math.min(w - 80, 300), audio.ambient, (v) => {
      settings.update({ audio: { ambient: v } });
    });

    return y;
  }

  private buildGameplayUI(x: number, y: number, _w: number): number {
    const gp = settings.getGameplay();

    y = this.addToggle(x, y, 'Auto Save', gp.autoSave, (v) => {
      settings.update({ gameplay: { autoSave: v } });
    });
    y = this.addToggle(x, y, 'Edge Scrolling', gp.edgeScrolling, (v) => {
      settings.update({ gameplay: { edgeScrolling: v } });
    });
    y = this.addToggle(x, y, 'Show Minimap', gp.showMinimap, (v) => {
      settings.update({ gameplay: { showMinimap: v } });
    });
    y = this.addToggle(x, y, 'Show FPS', gp.showFPS, (v) => {
      settings.update({ gameplay: { showFPS: v } });
    });

    return y;
  }

  private buildAccessibilityUI(x: number, y: number, _w: number): number {
    const acc = settings.getAccessibility();

    y = this.addDropdown(x, y, 'Color Blind Mode', ['none', 'protanopia', 'deuteranopia', 'tritanopia'], acc.colorBlindMode, (v) => {
      settings.update({ accessibility: { colorBlindMode: v as GameSettings['accessibility']['colorBlindMode'] } });
    });
    y += 4;
    y = this.addToggle(x, y, 'High Contrast', acc.highContrast, (v) => {
      settings.update({ accessibility: { highContrast: v } });
    });
    y = this.addToggle(x, y, 'Large Text', acc.largeText, (v) => {
      settings.update({ accessibility: { largeText: v } });
    });
    y = this.addToggle(x, y, 'Reduced Motion', acc.reducedMotion, (v) => {
      settings.update({ accessibility: { reducedMotion: v } });
    });
    y = this.addToggle(x, y, 'Screen Shake', acc.screenShake, (v) => {
      settings.update({ accessibility: { screenShake: v } });
    });

    return y;
  }

  private buildControlsUI(x: number, y: number, _w: number): number {
    const controls = settings.getControls();

    const entries = Object.entries(controls) as [string, string][];
    for (const [key, value] of entries) {
      const labelName = key.replace(/([A-Z])/g, ' $1').trim();
      this.addLabel(x, y, labelName);

      const btnX = x + 320;
      const keyBg = this.add.rectangle(btnX + 30, y + 8, 60, 22, 0x222233, 0.9);
      keyBg.setStrokeStyle(1, 0x555566);
      this.contentContainer!.add(keyBg);

      const keyText = this.add.text(btnX + 30, y + 8, value, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f1c40f',
      });
      keyText.setOrigin(0.5);
      this.contentContainer!.add(keyText);

      y += 28;
    }

    return y;
  }

  private async goBack(): Promise<void> {
    if (this.transition) {
      await this.transition.fadeOut({ duration: 200 });
    }
    this.scene.stop('Settings');
    if (this.returnScene === 'HUD') {
      this.scene.resume('Game');
      this.scene.resume('HUD');
    } else {
      this.scene.launch(this.returnScene);
    }
  }
}
