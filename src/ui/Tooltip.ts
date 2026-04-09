import Phaser from 'phaser';
import { hasComponent } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import Position from '@/game/ecs/components/Position.js';
import Health from '@/game/ecs/components/Health.js';
import Needs from '@/game/ecs/components/Needs.js';
import AIStateComponent from '@/game/ecs/components/AIState.js';
import Faction from '@/game/ecs/components/Faction.js';
import Structure from '@/game/ecs/components/Structure.js';
import ResourceSource from '@/game/ecs/components/ResourceSource.js';
import Reproduction from '@/game/ecs/components/Reproduction.js';
import Inventory from '@/game/ecs/components/Inventory.js';
import MarketInventory from '@/game/ecs/components/MarketInventory.js';
import {
  Creature,
  Building,
  Resource,
  Humanoid,
  Animal,
} from '@/game/ecs/components/TagComponents.js';
import { entityTypes } from '@/game/ecs/factories/CreatureFactory.js';
import { AIState } from '@/core/Types.js';
import { eventBus } from '@/core/EventBus.js';

const TOOLTIP_DELAY_MS = 300;
const TOOLTIP_OFFSET = 15;
const TOOLTIP_MAX_WIDTH = 200;
const BAR_WIDTH = 100;
const BAR_HEIGHT = 6;
const BG_COLOR = 0x1a1a2e;
const BG_ALPHA = 0.9;
const ACCENT_COLOR = 0xc9a227;

const FACTION_COLORS: Record<number, string> = {
  0: '#95a5a6',
  1: '#3498db',
  2: '#2ecc71',
  3: '#e74c3c',
};

const AI_STATE_LABELS: Record<string, string> = {
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

function getAIStateLabel(value: number): string {
  if (Number.isNaN(value)) return 'Idle';
  const str = String(value);
  if (AI_STATE_LABELS[str]) return AI_STATE_LABELS[str];
  return 'Idle';
}

function getTopNeed(world: GameWorld, eid: number): string {
  if (!hasComponent(world, eid, Needs)) return '—';
  const hunger = Needs.hunger[eid];
  const rest = Needs.rest[eid];
  const social = Needs.social[eid];
  const fun = Needs.fun[eid];
  // hunger increases toward 100 = bad; rest/social/fun decrease toward 0 = bad
  const scores: Array<{ name: string; urgency: number }> = [
    { name: 'Hunger', urgency: hunger },
    { name: 'Rest', urgency: 100 - rest },
    { name: 'Social', urgency: 100 - social },
    { name: 'Fun', urgency: 100 - fun },
  ];
  scores.sort((a, b) => b.urgency - a.urgency);
  return scores[0].name;
}

/**
 * Tooltip UI: shows info on entity hover after 300ms delay.
 * Hold Shift for detailed breakdown (needs values, inventory).
 * All Phaser GameObjects — no DOM.
 */
export class Tooltip {
  private scene: Phaser.Scene;
  private gameScene: Phaser.Scene | null = null;
  private container!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Rectangle;
  private border!: Phaser.GameObjects.Rectangle;
  private textLines: Phaser.GameObjects.Text[] = [];
  private textPool: Phaser.GameObjects.Text[] = [];
  private healthBarBg!: Phaser.GameObjects.Graphics;
  private healthBar!: Phaser.GameObjects.Graphics;

  private hoverTimer: Phaser.Time.TimerEvent | null = null;
  private currentEntityId: number | null = null;
  private visible: boolean = false;

  private initialized = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Defer all GameObject creation — scene.add is not available until boot.
  }

  /** Call from HUDScene.create() after the scene is ready. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const scene = this.scene;

    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(2000);
    this.container.setVisible(false);

    this.border = scene.add.rectangle(0, 0, TOOLTIP_MAX_WIDTH + 4, 4, ACCENT_COLOR, 1);
    this.border.setOrigin(0, 0);
    this.border.setStrokeStyle(1, ACCENT_COLOR);
    this.container.add(this.border);

    this.bg = scene.add.rectangle(0, 2, TOOLTIP_MAX_WIDTH + 4, 40, BG_COLOR, BG_ALPHA);
    this.bg.setOrigin(0, 0);
    this.container.add(this.bg);

    this.healthBarBg = scene.add.graphics();
    this.container.add(this.healthBarBg);

    this.healthBar = scene.add.graphics();
    this.container.add(this.healthBar);

    // Pre-allocate text pool
    for (let i = 0; i < 15; i++) {
      const txt = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        wordWrap: { width: TOOLTIP_MAX_WIDTH - 16 },
      });
      txt.setOrigin(0, 0);
      txt.setVisible(false);
      this.container.add(txt);
      this.textPool.push(txt);
    }
  }

  initGameKeyboard(scene: Phaser.Scene): void {
    this.gameScene = scene;
  }

  private isShiftDown(): boolean {
    return this.gameScene?.input.keyboard?.addKey('SHIFT')?.isDown ?? false;
  }

  /** Called every frame from HUDScene — tracks pointer and shift state. */
  update(world: GameWorld | null, pointer: Phaser.Input.Pointer): void {
    if (!world) return;

    const showDetailed = this.isShiftDown();

    // If already visible, update position and possibly content
    if (this.visible && this.currentEntityId !== null) {
      this.positionTooltip(pointer);
      if (showDetailed) {
        this.buildContent(world, this.currentEntityId, true);
      } else {
        this.buildContent(world, this.currentEntityId, false);
      }
    }
  }

  /**
   * Start hover timer for entity. Called when entity:hover fires.
   */
  startHover(entityId: number, world: GameWorld, pointer: Phaser.Input.Pointer): void {
    // If same entity, don't restart timer
    if (this.currentEntityId === entityId && this.hoverTimer !== null) return;

    this.cancelHover();

    this.currentEntityId = entityId;

    this.hoverTimer = this.scene.time.delayedCall(TOOLTIP_DELAY_MS, () => {
      const showDetailed = this.isShiftDown();
      this.show(world, entityId, pointer, showDetailed);
    });
  }

  /** Hide tooltip — called when pointer moves away from entity. */
  hide(): void {
    this.cancelHover();
    this.currentEntityId = null;
    this.visible = false;
    this.container.setVisible(false);
  }

  destroy(): void {
    this.cancelHover();
    this.container.destroy();
  }

  private cancelHover(): void {
    if (this.hoverTimer) {
      this.hoverTimer.destroy();
      this.hoverTimer = null;
    }
  }

  private show(
    world: GameWorld,
    entityId: number,
    pointer: Phaser.Input.Pointer,
    detailed: boolean,
  ): void {
    if (!hasComponent(world, entityId, Position)) {
      this.hide();
      return;
    }

    this.visible = true;
    this.container.setVisible(true);
    this.buildContent(world, entityId, detailed);
    this.positionTooltip(pointer);
  }

  private positionTooltip(pointer: Phaser.Input.Pointer): void {
    const { width, height } = this.scene.scale;
    let x = pointer.x + TOOLTIP_OFFSET;
    let y = pointer.y + TOOLTIP_OFFSET;

    const containerHeight = this.container.height || 60;
    if (x + TOOLTIP_MAX_WIDTH > width) {
      x = pointer.x - TOOLTIP_MAX_WIDTH - TOOLTIP_OFFSET;
    }
    if (y + containerHeight > height) {
      y = pointer.y - containerHeight - TOOLTIP_OFFSET;
    }

    this.container.setPosition(x, y);
  }

  private buildContent(world: GameWorld, entityId: number, detailed: boolean): void {
    // Hide all pooled text objects
    for (const txt of this.textPool) {
      txt.setVisible(false);
    }
    this.textLines = [];

    let yOffset = 6;
    const lines: Array<{ text: string; color: string }> = [];

    if (hasComponent(world, entityId, Creature)) {
      const typeName = entityTypes.get(entityId) ?? 'Creature';
      const factionId = hasComponent(world, entityId, Faction)
        ? Math.floor(Faction.id[entityId])
        : 0;
      const factionColor = FACTION_COLORS[factionId] ?? '#ffffff';
      lines.push({ text: typeName, color: factionColor });

      if (hasComponent(world, entityId, Health)) {
        const hp = Math.round(Health.current[entityId]);
        const maxHp = Math.round(Health.max[entityId]);
        lines.push({ text: `HP: ${hp}/${maxHp}`, color: '#e74c3c' });
      }

      if (hasComponent(world, entityId, AIStateComponent)) {
        const state = getAIStateLabel(AIStateComponent.state[entityId]);
        lines.push({ text: `State: ${state}`, color: '#f1c40f' });
      }

      lines.push({ text: `Need: ${getTopNeed(world, entityId)}`, color: '#95a5a6' });

      if (hasComponent(world, entityId, Reproduction)) {
        const age = Math.round(Reproduction.age[entityId]);
        lines.push({ text: `Age: ${age}s`, color: '#95a5a6' });
      }

      if (detailed) {
        if (hasComponent(world, entityId, Needs)) {
          lines.push({ text: `  Hunger: ${Math.round(Needs.hunger[entityId])}`, color: '#e67e22' });
          lines.push({ text: `  Rest: ${Math.round(Needs.rest[entityId])}`, color: '#3498db' });
          lines.push({ text: `  Social: ${Math.round(Needs.social[entityId])}`, color: '#e74c3c' });
          lines.push({ text: `  Fun: ${Math.round(Needs.fun[entityId])}`, color: '#2ecc71' });
        }

        if (hasComponent(world, entityId, Inventory)) {
          const w = Math.round(Inventory.wood[entityId]);
          const f = Math.round(Inventory.food[entityId]);
          const s = Math.round(Inventory.stone[entityId]);
          const g = Math.round(Inventory.gold[entityId]);
          const ir = Math.round(Inventory.iron[entityId]);
          lines.push({ text: `Inv: W${w} F${f} S${s} G${g} I${ir}`, color: '#bdc3c7' });
        }
      }
    } else if (hasComponent(world, entityId, Building)) {
      const factionId = hasComponent(world, entityId, Faction)
        ? Math.floor(Faction.id[entityId])
        : 0;
      lines.push({ text: 'Building', color: FACTION_COLORS[factionId] ?? '#ffffff' });

      if (hasComponent(world, entityId, Structure)) {
        lines.push({
          text: `Level: ${Math.floor(Structure.level[entityId])}`,
          color: '#f1c40f',
        });
      }

      if (hasComponent(world, entityId, Health)) {
        const hp = Math.round(Health.current[entityId]);
        const maxHp = Math.round(Health.max[entityId]);
        lines.push({ text: `HP: ${hp}/${maxHp}`, color: '#e74c3c' });
      }

      if (hasComponent(world, entityId, Faction)) {
        lines.push({
          text: `Faction: ${Math.floor(Faction.id[entityId])}`,
          color: '#95a5a6',
        });
      }

      // Marketplace stock
      if (hasComponent(world, entityId, MarketInventory)) {
        lines.push({ text: 'Market:', color: '#e6b800' });
        const stock = [
          `W:${Math.floor(MarketInventory.wood[entityId])}`,
          `F:${Math.floor(MarketInventory.food[entityId])}`,
          `S:${Math.floor(MarketInventory.stone[entityId])}`,
          `I:${Math.floor(MarketInventory.iron[entityId])}`,
          `H:${Math.floor(MarketInventory.herbs[entityId])}`,
          `C:${Math.floor(MarketInventory.crystal[entityId])}`,
        ].join(' ');
        lines.push({ text: `  ${stock}`, color: '#f5e6a3' });
        lines.push({
          text: `  Gold: ${Math.floor(MarketInventory.goldReserve[entityId])}`,
          color: '#f1c40f',
        });
      }
    } else if (hasComponent(world, entityId, Resource)) {
      if (hasComponent(world, entityId, ResourceSource)) {
        const amount = Math.round(ResourceSource.amount[entityId]);
        lines.push({ text: 'Resource', color: '#2ecc71' });
        lines.push({ text: `Remaining: ${amount}`, color: '#ecf0f1' });
      }
    }

    if (lines.length === 0) return;

    // Reuse pooled text objects
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let txt: Phaser.GameObjects.Text;
      if (i < this.textPool.length) {
        txt = this.textPool[i]!;
        txt.setText(line.text);
        txt.setColor(line.color);
        txt.setPosition(8, yOffset);
        txt.setVisible(true);
      } else {
        // Grow pool if needed
        txt = this.scene.add.text(8, yOffset, line.text, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: line.color,
          wordWrap: { width: TOOLTIP_MAX_WIDTH - 16 },
        });
        txt.setOrigin(0, 0);
        this.container.add(txt);
        this.textPool.push(txt);
      }
      this.textLines.push(txt);
      yOffset += (txt.height ?? 14) + 2;
    }

    // Draw health bar if creature or building
    this.healthBarBg.clear();
    this.healthBar.clear();

    const hasHealth =
      hasComponent(world, entityId, Creature) || hasComponent(world, entityId, Building);
    if (hasHealth && hasComponent(world, entityId, Health)) {
      const hp = Health.current[entityId];
      const maxHp = Health.max[entityId];
      const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

      const barX = 8;
      const barY = yOffset + 2;

      this.healthBarBg.fillStyle(0x333333, 0.8);
      this.healthBarBg.fillRect(barX, barY, BAR_WIDTH, BAR_HEIGHT);

      const r = Math.floor(255 * (1 - ratio));
      const g = Math.floor(255 * ratio);
      this.healthBar.fillStyle((r << 16) | (g << 8), 0.9);
      this.healthBar.fillRect(barX, barY, BAR_WIDTH * ratio, BAR_HEIGHT);

      yOffset += BAR_HEIGHT + 6;
    }

    // Resize background
    const totalHeight = yOffset + 4;
    const totalWidth = TOOLTIP_MAX_WIDTH + 4;
    this.bg.setSize(totalWidth, totalHeight);
    this.border.setSize(totalWidth, totalHeight + 2);
  }
}
