import Phaser from 'phaser';
import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import Position from '@/game/ecs/components/Position.js';
import Health from '@/game/ecs/components/Health.js';
import Needs from '@/game/ecs/components/Needs.js';
import AIStateComponent from '@/game/ecs/components/AIState.js';
import Faction from '@/game/ecs/components/Faction.js';
import SpriteRef from '@/game/ecs/components/SpriteRef.js';
import { Creature, Humanoid, Animal } from '@/game/ecs/components/TagComponents.js';
import { AIState, NeedType, WeaponType, ArmorType, MilitaryRoleType, DiplomacyState } from '@/core/Types.js';
import Equipment from '@/game/ecs/components/Equipment.js';
import MilitaryRole from '@/game/ecs/components/MilitaryRole.js';
import { getDiplomacyState } from '@/game/ecs/systems/DiplomacySystem.js';

const PANEL_WIDTH = 180;
const PANEL_HEIGHT = 340;
const BAR_WIDTH = 140;
const BAR_HEIGHT = 10;
const BAR_GAP = 20;

const NEED_COLORS: Record<string, number> = {
  [NeedType.Hunger]: 0xe67e22,
  [NeedType.Rest]: 0x3498db,
  [NeedType.Social]: 0xe74c3c,
  [NeedType.Fun]: 0x2ecc71,
};

const AI_STATE_DISPLAY: Record<string, string> = {
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

function getAIStateName(stateValue: number): string {
  if (Number.isNaN(stateValue)) return 'Idle';
  const str = String(stateValue);
  if (AI_STATE_DISPLAY[str]) return AI_STATE_DISPLAY[str];
  // String enum values stored via `as unknown as number` — check by enum value
  for (const [, display] of Object.entries(AI_STATE_DISPLAY)) {
    // The stored value in Float32Array for string enums is NaN,
    // so we just return Idle as a sensible default
  }
  return 'Idle';
}

function getCreatureType(world: GameWorld, eid: number): string {
  if (hasComponent(world, eid, Humanoid)) return 'Humanoid';
  if (hasComponent(world, eid, Animal)) return 'Animal';
  if (hasComponent(world, eid, Creature)) return 'Creature';
  return 'Entity';
}

export class EntityInfoPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private healthLabel: Phaser.GameObjects.Text;
  private healthBarBg: Phaser.GameObjects.Graphics;
  private healthBar: Phaser.GameObjects.Graphics;
  private healthText: Phaser.GameObjects.Text;
  private needBars: Map<string, Phaser.GameObjects.Graphics>;
  private needLabels: Map<string, Phaser.GameObjects.Text>;
  private needTexts: Map<string, Phaser.GameObjects.Text>;
  private stateText: Phaser.GameObjects.Text;
  private factionText: Phaser.GameObjects.Text;
  private posText: Phaser.GameObjects.Text;
  private equipText: Phaser.GameObjects.Text;
  private militaryText: Phaser.GameObjects.Text;
  private diplomacyText: Phaser.GameObjects.Text;
  private selectedEntityId: number | null = null;
  private _visible: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.needBars = new Map();
    this.needLabels = new Map();
    this.needTexts = new Map();

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);
    this.container.setVisible(false);

    // Background
    this.background = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0.75);
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(1, 0x555555);
    this.container.add(this.background);

    // Close button area (top-right)
    const closeBtn = scene.add.rectangle(PANEL_WIDTH - 16, 12, 20, 16, 0x333333, 0.8);
    closeBtn.setOrigin(0.5, 0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    const closeLabel = scene.add.text(PANEL_WIDTH - 16, 12, 'X', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#e74c3c',
    });
    closeLabel.setOrigin(0.5, 0.5);
    closeBtn.on('pointerdown', () => this.deselect());
    this.container.add([closeBtn, closeLabel]);

    // Title (creature type)
    this.titleText = scene.add.text(10, 8, 'Unknown', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ecf0f1',
      fontStyle: 'bold',
    });
    this.container.add(this.titleText);

    // Health section
    this.healthLabel = scene.add.text(10, 30, 'HP', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#e74c3c',
    });
    this.container.add(this.healthLabel);

    this.healthBarBg = scene.add.graphics();
    this.healthBarBg.setPosition(10, 42);
    this.container.add(this.healthBarBg);

    this.healthBar = scene.add.graphics();
    this.healthBar.setPosition(10, 42);
    this.container.add(this.healthBar);

    this.healthText = scene.add.text(PANEL_WIDTH - 10, 30, '100/100', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ecf0f1',
    });
    this.healthText.setOrigin(1, 0);
    this.container.add(this.healthText);

    // Needs bars
    const needs = [NeedType.Hunger, NeedType.Rest, NeedType.Social, NeedType.Fun];
    let ny = 60;

    for (const need of needs) {
      const label = scene.add.text(10, ny, need, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#' + (NEED_COLORS[need] ?? 0xffffff).toString(16).padStart(6, '0'),
      });
      this.container.add(label);
      this.needLabels.set(need, label);

      const barBg = scene.add.graphics();
      barBg.setPosition(10, ny + 12);
      this.container.add(barBg);

      const bar = scene.add.graphics();
      bar.setPosition(10, ny + 12);
      this.container.add(bar);
      this.needBars.set(need, bar);

      const valueText = scene.add.text(PANEL_WIDTH - 10, ny, '100', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ecf0f1',
      });
      valueText.setOrigin(1, 0);
      this.container.add(valueText);
      this.needTexts.set(need, valueText);

      ny += BAR_GAP + 12;
    }

    // AI State
    this.stateText = scene.add.text(10, ny + 4, 'State: Idle', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#f1c40f',
    });
    this.container.add(this.stateText);

    // Faction
    this.factionText = scene.add.text(10, ny + 18, 'Faction: 0', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#95a5a6',
    });
    this.container.add(this.factionText);

    // Position
    this.posText = scene.add.text(10, ny + 32, 'Pos: 0, 0', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#95a5a6',
    });
    this.container.add(this.posText);

    // Equipment
    this.equipText = scene.add.text(10, ny + 46, 'Weapon: None', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#bdc3c7',
    });
    this.container.add(this.equipText);

    // Military role
    this.militaryText = scene.add.text(10, ny + 58, 'Role: None (R0)', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#bdc3c7',
    });
    this.container.add(this.militaryText);

    // Diplomacy
    this.diplomacyText = scene.add.text(10, ny + 70, '', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#95a5a6',
    });
    this.container.add(this.diplomacyText);
  }

  selectEntity(entityId: number, world: GameWorld): void {
    this.selectedEntityId = entityId;
    this._visible = true;
    this.container.setVisible(true);
    this.update(world);
  }

  deselect(): void {
    this.selectedEntityId = null;
    this._visible = false;
    this.container.setVisible(false);
  }

  getSelectedEntityId(): number | null {
    return this.selectedEntityId;
  }

  isVisible(): boolean {
    return this._visible;
  }

  update(world: GameWorld): void {
    if (this.selectedEntityId === null || !this._visible) return;

    const eid = this.selectedEntityId;

    // Check if entity still exists (has Position component)
    if (!hasComponent(world, eid, Position)) {
      this.deselect();
      return;
    }

    // Title
    this.titleText.setText(getCreatureType(world, eid));

    // Health bar
    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x333333, 0.8);
    this.healthBarBg.fillRect(0, 0, BAR_WIDTH, BAR_HEIGHT);

    this.healthBar.clear();
    if (hasComponent(world, eid, Health)) {
      const hp = Health.current[eid];
      const maxHp = Health.max[eid];
      const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

      // Color gradient from green to red
      const r = Math.floor(255 * (1 - ratio));
      const g = Math.floor(255 * ratio);
      const barColor = (r << 16) | (g << 8);

      this.healthBar.fillStyle(barColor, 0.9);
      this.healthBar.fillRect(0, 0, BAR_WIDTH * ratio, BAR_HEIGHT);

      this.healthText.setText(`${Math.round(hp)}/${Math.round(maxHp)}`);
    }

    // Needs bars
    const needKeys: Record<string, keyof typeof Needs> = {
      [NeedType.Hunger]: 'hunger',
      [NeedType.Rest]: 'rest',
      [NeedType.Social]: 'social',
      [NeedType.Fun]: 'fun',
    };

    if (hasComponent(world, eid, Needs)) {
      for (const [needType, componentKey] of Object.entries(needKeys)) {
        const bar = this.needBars.get(needType);
        if (!bar) continue;

        const value = Needs[componentKey][eid];
        const ratio = Math.max(0, Math.min(1, value / 100));

        bar.clear();
        const color = NEED_COLORS[needType] ?? 0xffffff;
        bar.fillStyle(color, 0.8);
        bar.fillRect(0, 0, BAR_WIDTH * ratio, BAR_HEIGHT);

        const text = this.needTexts.get(needType);
        if (text) {
          text.setText(`${Math.round(value)}`);
        }
      }
    }

    // AI State
    if (hasComponent(world, eid, AIStateComponent)) {
      const stateVal = AIStateComponent.state[eid];
      this.stateText.setText(`State: ${getAIStateName(stateVal)}`);
    }

    // Faction
    if (hasComponent(world, eid, Faction)) {
      this.factionText.setText(`Faction: ${Math.floor(Faction.id[eid])}`);
    }

    // Position
    const px = Math.round(Position.x[eid]);
    const py = Math.round(Position.y[eid]);
    this.posText.setText(`Pos: ${px}, ${py}`);

    // Equipment
    if (hasComponent(world, eid, Equipment)) {
      const weaponIdx = Math.floor(Equipment.weapon[eid]);
      const armorIdx = Math.floor(Equipment.armor[eid]);
      const weaponNames = Object.values(WeaponType);
      const armorNames = Object.values(ArmorType);
      const wName = weaponNames[weaponIdx] ?? 'None';
      const aName = armorNames[armorIdx] ?? 'None';
      this.equipText.setText(`W: ${wName} | A: ${aName}`);
      this.equipText.setColor(wName !== 'None' || aName !== 'None' ? '#f39c12' : '#bdc3c7');
    } else {
      this.equipText.setText('W: None | A: None');
      this.equipText.setColor('#555555');
    }

    // Military role
    if (hasComponent(world, eid, MilitaryRole)) {
      const roleIdx = Math.floor(MilitaryRole.role[eid]);
      const rank = Math.floor(MilitaryRole.rank[eid]);
      const roleNames = Object.values(MilitaryRoleType);
      const rName = roleNames[roleIdx] ?? 'None';
      this.militaryText.setText(`Role: ${rName} (R${rank})`);
      this.militaryText.setColor(rName !== 'None' ? '#e74c3c' : '#bdc3c7');
    } else {
      this.militaryText.setText('Role: None');
      this.militaryText.setColor('#555555');
    }

    // Diplomacy state (show for selected entity's faction vs others)
    if (hasComponent(world, eid, Faction)) {
      const myFaction = Math.floor(Faction.id[eid]);
      const lines: string[] = [];
      for (let f = 0; f <= 5; f++) {
        if (f === myFaction) continue;
        try {
          const state = getDiplomacyState(myFaction, f);
          if (state !== DiplomacyState.Neutral) {
            lines.push(`F${f}:${state}`);
          }
        } catch { /* diplomacy not initialized */ }
      }
      this.diplomacyText.setText(lines.length > 0 ? lines.join(' ') : '');
    } else {
      this.diplomacyText.setText('');
    }
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  destroy(): void {
    this.container.destroy();
  }
}
