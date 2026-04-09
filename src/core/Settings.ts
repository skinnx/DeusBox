const SETTINGS_KEY = 'deusbox_settings';

export interface GameSettings {
  graphics: {
    quality: 'low' | 'medium' | 'high' | 'ultra';
    particles: boolean;
    dayNightCycle: boolean;
    weatherEffects: boolean;
    damageNumbers: boolean;
    territoryOverlay: boolean;
    maxFPS: 30 | 60 | 120 | 0;
    antiAlias: boolean;
  };
  audio: {
    master: number;
    sfx: number;
    music: number;
    ambient: number;
    enabled: boolean;
  };
  gameplay: {
    autoSave: boolean;
    autoSaveInterval: number;
    cameraSpeed: number;
    edgeScrolling: boolean;
    tooltipDelay: number;
    showMinimap: boolean;
    showFPS: boolean;
  };
  accessibility: {
    colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    screenShake: boolean;
  };
  controls: {
    panUp: string;
    panDown: string;
    panLeft: string;
    panRight: string;
    pause: string;
    quickSave: string;
    quickLoad: string;
    toggleMinimap: string;
    toggleTerritory: string;
    toggleFPS: string;
  };
}

export interface PartialGameSettings {
  graphics?: Partial<GameSettings['graphics']>;
  audio?: Partial<GameSettings['audio']>;
  gameplay?: Partial<GameSettings['gameplay']>;
  accessibility?: Partial<GameSettings['accessibility']>;
  controls?: Partial<GameSettings['controls']>;
}

const DEFAULT_SETTINGS: GameSettings = {
  graphics: {
    quality: 'high',
    particles: true,
    dayNightCycle: true,
    weatherEffects: true,
    damageNumbers: true,
    territoryOverlay: false,
    maxFPS: 60,
    antiAlias: false,
  },
  audio: {
    master: 0.8,
    sfx: 0.7,
    music: 0.5,
    ambient: 0.4,
    enabled: true,
  },
  gameplay: {
    autoSave: true,
    autoSaveInterval: 60000,
    cameraSpeed: 400,
    edgeScrolling: true,
    tooltipDelay: 300,
    showMinimap: true,
    showFPS: false,
  },
  accessibility: {
    colorBlindMode: 'none',
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenShake: true,
  },
  controls: {
    panUp: 'W',
    panDown: 'S',
    panLeft: 'A',
    panRight: 'D',
    pause: 'SPACE',
    quickSave: 'F5',
    quickLoad: 'F9',
    toggleMinimap: 'M',
    toggleTerritory: 'T',
    toggleFPS: 'F3',
  },
};

class SettingsManager {
  private static instance: SettingsManager | null = null;
  private settings: GameSettings;
  private listeners: Set<(settings: GameSettings) => void> = new Set();

  private constructor() {
    this.settings = this.load();
  }

  static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  get(): GameSettings {
    return this.settings;
  }

  getGraphics(): GameSettings['graphics'] {
    return this.settings.graphics;
  }

  getAudio(): GameSettings['audio'] {
    return this.settings.audio;
  }

  getGameplay(): GameSettings['gameplay'] {
    return this.settings.gameplay;
  }

  getAccessibility(): GameSettings['accessibility'] {
    return this.settings.accessibility;
  }

  getControls(): GameSettings['controls'] {
    return this.settings.controls;
  }

  update(partial: PartialGameSettings): void {
    if (partial.graphics) {
      Object.assign(this.settings.graphics, partial.graphics);
    }
    if (partial.audio) {
      Object.assign(this.settings.audio, partial.audio);
    }
    if (partial.gameplay) {
      Object.assign(this.settings.gameplay, partial.gameplay);
    }
    if (partial.accessibility) {
      Object.assign(this.settings.accessibility, partial.accessibility);
    }
    if (partial.controls) {
      Object.assign(this.settings.controls, partial.controls);
    }
    this.save();
    this.notifyListeners();
  }

  reset(): void {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.save();
    this.notifyListeners();
  }

  onChange(callback: (settings: GameSettings) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    for (const cb of this.listeners) {
      try {
        cb(this.settings);
      } catch {
        // ignore listener errors
      }
    }
  }

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return this.mergeWithDefaults(parsed);
      }
    } catch {
      // corrupted settings, use defaults
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  private save(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // storage full or unavailable
    }
  }

  private mergeWithDefaults(saved: Partial<GameSettings>): GameSettings {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as GameSettings;
    if (saved.graphics) Object.assign(defaults.graphics, saved.graphics);
    if (saved.audio) Object.assign(defaults.audio, saved.audio);
    if (saved.gameplay) Object.assign(defaults.gameplay, saved.gameplay);
    if (saved.accessibility) Object.assign(defaults.accessibility, saved.accessibility);
    if (saved.controls) Object.assign(defaults.controls, saved.controls);
    return defaults;
  }
}

export const settings = SettingsManager.getInstance();
export { SettingsManager };
