import Phaser from 'phaser';
import { hasComponent } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import Position from '@/game/ecs/components/Position.js';
import {
  Creature,
  Building,
  Resource,
  Humanoid,
  Animal,
} from '@/game/ecs/components/TagComponents.js';
import { eventBus } from '@/core/EventBus.js';
import { SelectionManager } from '@/ui/SelectionManager.js';

const BG_COLOR = 0x1a1a2e;
const BG_ALPHA = 0.92;
const ACCENT_COLOR = 0xc9a227;
const ITEM_HEIGHT = 24;
const ITEM_WIDTH = 160;
const ITEM_PAD_X = 8;
const FONT_SIZE = '12px';

interface MenuItem {
  label: string;
  action: string;
  hotkey: string;
  children?: MenuItem[];
}

const HUMANOID_ITEMS: MenuItem[] = [
  { label: 'Inspect', action: 'inspect', hotkey: 'I' },
  { label: 'Assign Work', action: 'assign_work', hotkey: 'W' },
  { label: 'Toggle AI', action: 'toggle_ai', hotkey: 'T' },
  { label: 'Attack Nearest', action: 'attack_nearest', hotkey: 'A' },
  { label: 'Heal', action: 'heal', hotkey: 'H' },
  { label: 'Kill', action: 'kill', hotkey: 'K' },
];

const ANIMAL_ITEMS: MenuItem[] = [
  { label: 'Inspect', action: 'inspect', hotkey: 'I' },
  { label: 'Tame', action: 'tame', hotkey: 'T' },
  { label: 'Hunt', action: 'hunt', hotkey: 'U' },
  { label: 'Heal', action: 'heal', hotkey: 'H' },
  { label: 'Kill', action: 'kill', hotkey: 'K' },
];

const BUILDING_ITEMS: MenuItem[] = [
  { label: 'Inspect', action: 'inspect', hotkey: 'I' },
  { label: 'Upgrade', action: 'upgrade', hotkey: 'U' },
  { label: 'Demolish', action: 'demolish', hotkey: 'D' },
];

const RESOURCE_ITEMS: MenuItem[] = [
  { label: 'Harvest', action: 'harvest', hotkey: 'V' },
  { label: 'Inspect', action: 'inspect', hotkey: 'I' },
];

const TERRAFORM_ITEMS: MenuItem[] = [
  { label: 'Terraform > Grass', action: 'terraform_grass', hotkey: '1' },
  { label: 'Terraform > Desert', action: 'terraform_desert', hotkey: '2' },
  { label: 'Terraform > Water', action: 'terraform_water', hotkey: '3' },
  { label: 'Terraform > Mountain', action: 'terraform_mountain', hotkey: '4' },
];

const SPAWN_ITEMS: MenuItem[] = [
  { label: 'Spawn Human', action: 'spawn_human', hotkey: '5' },
  { label: 'Spawn Wolf', action: 'spawn_wolf', hotkey: '6' },
  { label: 'Spawn Deer', action: 'spawn_deer', hotkey: '7' },
];

/**
 * Context Menu: right-click on entity or empty tile to open.
 * Displays a list of actions based on entity type.
 * 'C' key opens context menu at cursor position.
 * Escape or click outside closes.
 */
export class ContextMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private itemContainers: Phaser.GameObjects.Container[] = [];
  private submenuContainer: Phaser.GameObjects.Container | null = null;
  private submenuItemContainers: Phaser.GameObjects.Container[] = [];

  private currentEntityId: number = -1;
  private isVisible: boolean = false;
  private currentWorldX: number = 0;
  private currentWorldY: number = 0;

  private keyC: Phaser.Input.Keyboard.Key | null = null;
  private keyEsc: Phaser.Input.Keyboard.Key | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Call from HUDScene.create() after scene is fully initialized. */
  init(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(3000);
    this.container.setVisible(false);
  }

  /**
   * Show context menu for a specific entity or empty tile.
   * @param screenX - screen X position
   * @param screenY - screen Y position
   * @param entityId - entity ID, or -1 for empty tile
   * @param world - ECS world for entity type lookup
   */
  showForEntity(screenX: number, screenY: number, entityId: number, world: GameWorld): void {
    this.currentEntityId = entityId;

    const cam = this.scene.scene.get('Game').cameras.main;
    this.currentWorldX = cam.scrollX + screenX / cam.zoom;
    this.currentWorldY = cam.scrollY + screenY / cam.zoom;

    let items: MenuItem[] = EMPTY_TILE_ITEMS;

    if (hasComponent(world, entityId, Humanoid)) {
      items = HUMANOID_ITEMS;
    } else if (hasComponent(world, entityId, Animal)) {
      items = ANIMAL_ITEMS;
    } else if (hasComponent(world, entityId, Building)) {
      items = BUILDING_ITEMS;
    } else if (hasComponent(world, entityId, Resource)) {
      items = RESOURCE_ITEMS;
    } else if (hasComponent(world, entityId, Creature)) {
      items = ANIMAL_ITEMS;
    }

    this.show(screenX, screenY, items);
  }

  /**
   * Show for empty tile.
   */
  showForEmptyTile(screenX: number, screenY: number): void {
    this.currentEntityId = -1;
    const cam = this.scene.scene.get('Game').cameras.main;
    this.currentWorldX = cam.scrollX + screenX / cam.zoom;
    this.currentWorldY = cam.scrollY + screenY / cam.zoom;
    this.show(screenX, screenY, EMPTY_TILE_ITEMS);
  }

  private show(screenX: number, screenY: number, items: MenuItem[]): void {
    this.hide();
    if (!this.container) return;
    this.isVisible = true;
    this.container.setVisible(true);

    const { width, height } = this.scene.scale;

    let x = screenX;
    let y = screenY;

    // Keep on screen
    const menuHeight = items.length * ITEM_HEIGHT + 8;
    if (x + ITEM_WIDTH > width) x = width - ITEM_WIDTH - 4;
    if (y + menuHeight > height) y = height - menuHeight - 4;
    if (x < 0) x = 4;
    if (y < 0) y = 4;

    this.container.setPosition(x, y);

    // Background
    const bg = this.scene.add.rectangle(
      ITEM_WIDTH / 2,
      menuHeight / 2,
      ITEM_WIDTH,
      menuHeight,
      BG_COLOR,
      BG_ALPHA,
    );
    bg.setOrigin(0.5, 0.5);
    bg.setStrokeStyle(1, ACCENT_COLOR);
    this.container.add(bg);

    // Items
    let itemY = 4;
    for (const item of items) {
      const itemContainer = this.createMenuItem(4, itemY, item);
      this.itemContainers.push(itemContainer);
      this.container.add(itemContainer);
      itemY += ITEM_HEIGHT;
    }
  }

  private createMenuItem(x: number, y: number, item: MenuItem): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, ITEM_WIDTH - 8, ITEM_HEIGHT - 2, 0x000000, 0);
    bg.setOrigin(0, 0);
    bg.setInteractive({ useHandCursor: true });

    // Underline the hotkey letter in the label
    const hotkeyIndex = item.label.toLowerCase().indexOf(item.hotkey.toLowerCase());
    const displayText =
      hotkeyIndex >= 0
        ? item.label.substring(0, hotkeyIndex) +
          '[' +
          item.label.substring(hotkeyIndex, hotkeyIndex + 1) +
          ']' +
          item.label.substring(hotkeyIndex + 1)
        : item.label + ` [${item.hotkey}]`;

    const text = this.scene.add.text(6, 4, displayText, {
      fontFamily: 'monospace',
      fontSize: FONT_SIZE,
      color: '#ecf0f1',
    });
    text.setOrigin(0, 0);

    container.add([bg, text]);
    container.setSize(ITEM_WIDTH - 8, ITEM_HEIGHT - 2);

    bg.on('pointerover', () => {
      bg.setFillStyle(ACCENT_COLOR, 0.3);
      text.setColor('#f1c40f');
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x000000, 0);
      text.setColor('#ecf0f1');
    });

    bg.on('pointerdown', () => {
      this.onItemSelected(item);
    });

    return container;
  }

  private onItemSelected(item: MenuItem): void {
    // Handle submenu items
    if (item.action === 'terraform_submenu') {
      this.showSubmenu(TERRAFORM_ITEMS);
      return;
    }
    if (item.action === 'spawn_submenu') {
      this.showSubmenu(SPAWN_ITEMS);
      return;
    }

    // Emit action event
    eventBus.emit('contextmenu:action', {
      action: item.action,
      entityId: this.currentEntityId,
      data: { worldX: this.currentWorldX, worldY: this.currentWorldY },
    });

    // Handle inspect → also select entity
    if (item.action === 'inspect' && this.currentEntityId >= 0) {
      SelectionManager.getInstance().select(this.currentEntityId);
    }

    this.hide();
  }

  private showSubmenu(items: MenuItem[]): void {
    this.clearSubmenu();
    if (!this.container) return;

    const parentX = this.container.x + ITEM_WIDTH;
    const parentY = this.container.y;

    this.submenuContainer = this.scene.add.container(parentX, parentY);
    this.submenuContainer.setScrollFactor(0);
    this.submenuContainer.setDepth(3001);

    const { width, height } = this.scene.scale;
    let sx = parentX;
    let sy = parentY;
    const menuHeight = items.length * ITEM_HEIGHT + 8;
    if (sx + ITEM_WIDTH > width) sx = parentX - ITEM_WIDTH * 2;
    if (sy + menuHeight > height) sy = height - menuHeight - 4;
    this.submenuContainer.setPosition(sx, sy);

    const bg = this.scene.add.rectangle(
      ITEM_WIDTH / 2,
      menuHeight / 2,
      ITEM_WIDTH,
      menuHeight,
      BG_COLOR,
      BG_ALPHA,
    );
    bg.setOrigin(0.5, 0.5);
    bg.setStrokeStyle(1, ACCENT_COLOR);
    this.submenuContainer.add(bg);

    let itemY = 4;
    for (const item of items) {
      const itemContainer = this.createSubmenuItem(4, itemY, item);
      this.submenuItemContainers.push(itemContainer);
      this.submenuContainer.add(itemContainer);
      itemY += ITEM_HEIGHT;
    }
  }

  private createSubmenuItem(x: number, y: number, item: MenuItem): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, ITEM_WIDTH - 8, ITEM_HEIGHT - 2, 0x000000, 0);
    bg.setOrigin(0, 0);
    bg.setInteractive({ useHandCursor: true });

    const hotkeyIndex = item.label.toLowerCase().indexOf(item.hotkey.toLowerCase());
    const displayText =
      hotkeyIndex >= 0
        ? item.label.substring(0, hotkeyIndex) +
          '[' +
          item.label.substring(hotkeyIndex, hotkeyIndex + 1) +
          ']' +
          item.label.substring(hotkeyIndex + 1)
        : item.label + ` [${item.hotkey}]`;

    const text = this.scene.add.text(6, 4, displayText, {
      fontFamily: 'monospace',
      fontSize: FONT_SIZE,
      color: '#ecf0f1',
    });
    text.setOrigin(0, 0);

    container.add([bg, text]);
    container.setSize(ITEM_WIDTH - 8, ITEM_HEIGHT - 2);

    bg.on('pointerover', () => {
      bg.setFillStyle(ACCENT_COLOR, 0.3);
      text.setColor('#f1c40f');
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x000000, 0);
      text.setColor('#ecf0f1');
    });

    bg.on('pointerdown', () => {
      this.onItemSelected(item);
    });

    return container;
  }

  private clearSubmenu(): void {
    for (const ic of this.submenuItemContainers) {
      ic.destroy();
    }
    this.submenuItemContainers = [];
    if (this.submenuContainer) {
      this.submenuContainer.destroy();
      this.submenuContainer = null;
    }
  }

  hide(): void {
    this.isVisible = false;
    if (this.container) {
      this.container.setVisible(false);
    }

    // Clear all children
    for (const ic of this.itemContainers) {
      ic.destroy();
    }
    this.itemContainers = [];
    this.container?.removeAll(true);

    this.clearSubmenu();
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  destroy(): void {
    this.hide();
    this.container?.destroy();
    this.container = null;
  }
}

/** Menu items for empty tile clicks */
const EMPTY_TILE_ITEMS: MenuItem[] = [
  { label: 'Terraform', action: 'terraform_submenu', hotkey: 'R' },
  { label: 'Spawn', action: 'spawn_submenu', hotkey: 'S' },
];
