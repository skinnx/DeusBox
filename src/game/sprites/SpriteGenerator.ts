import Phaser from 'phaser';
import creatureData from '@/data/creatures.json';
import buildingData from '@/data/buildings.json';

/**
 * Generates pixel art creature and building textures programmatically
 * using Phaser Graphics objects.
 */
export class SpriteGenerator {
  /**
   * Generates pixel art sprites for all creature types.
   * Creates textures like 'creature_human', 'creature_elf', etc.
   */
  static generateCreatureSprites(scene: Phaser.Scene): void {
    const gfx = scene.add.graphics();

    const creatureTypes = Object.keys(creatureData);
    const humanoidTypes = new Set(['human', 'elf', 'dwarf', 'orc']);

    for (const type of creatureTypes) {
      const config = creatureData[type as keyof typeof creatureData];
      const color = Phaser.Display.Color.HexStringToColor(config.color);

      gfx.clear();

      if (type === 'wolf') {
        SpriteGenerator.drawWolf(gfx, color.color);
        gfx.generateTexture(`creature_${type}`, 12, 8);
      } else if (type === 'deer') {
        SpriteGenerator.drawDeer(gfx, color.color);
        gfx.generateTexture(`creature_${type}`, 10, 10);
      } else if (type === 'chicken') {
        SpriteGenerator.drawChicken(gfx, color.color);
        gfx.generateTexture(`creature_${type}`, 6, 6);
      } else if (type === 'bear') {
        SpriteGenerator.drawBear(gfx, color.color);
        gfx.generateTexture(`creature_${type}`, 14, 10);
      } else if (type === 'fish') {
        SpriteGenerator.drawFish(gfx, color.color);
        gfx.generateTexture(`creature_${type}`, 8, 4);
      } else if (type === 'orc') {
        // Base orc texture
        SpriteGenerator.drawOrc(gfx, color.color);
        gfx.generateTexture(`creature_${type}`, 10, 12);

        // Military role variants for orc
        if ('militaryAptitude' in config && config.militaryAptitude) {
          gfx.clear();
          SpriteGenerator.drawOrc(gfx, color.color);
          SpriteGenerator.drawWarriorOverlay(gfx, 10);
          gfx.generateTexture(`creature_${type}_warrior`, 10, 12);

          gfx.clear();
          SpriteGenerator.drawOrc(gfx, color.color);
          SpriteGenerator.drawArcherOverlay(gfx, 10);
          gfx.generateTexture(`creature_${type}_archer`, 10, 12);

          gfx.clear();
          SpriteGenerator.drawOrc(gfx, color.color);
          SpriteGenerator.drawMageOverlay(gfx, 10);
          gfx.generateTexture(`creature_${type}_mage`, 10, 12);
        }
      } else {
        // Humanoid types: human, elf, dwarf — base texture
        SpriteGenerator.drawHumanoid(gfx, color.color);
        gfx.generateTexture(`creature_${type}`, 8, 12);

        // Military role variants
        if ('militaryAptitude' in config && config.militaryAptitude) {
          gfx.clear();
          SpriteGenerator.drawHumanoid(gfx, color.color);
          SpriteGenerator.drawWarriorOverlay(gfx, 8);
          gfx.generateTexture(`creature_${type}_warrior`, 8, 12);

          gfx.clear();
          SpriteGenerator.drawHumanoid(gfx, color.color);
          SpriteGenerator.drawArcherOverlay(gfx, 8);
          gfx.generateTexture(`creature_${type}_archer`, 8, 12);

          gfx.clear();
          SpriteGenerator.drawHumanoid(gfx, color.color);
          SpriteGenerator.drawMageOverlay(gfx, 8);
          gfx.generateTexture(`creature_${type}_mage`, 8, 12);
        }
      }
    }

    gfx.destroy();
  }

  /**
   * Generates pixel art sprites for all building types.
   * Creates textures like 'building_house', 'building_farm', etc.
   */
  static generateBuildingSprites(scene: Phaser.Scene): void {
    const gfx = scene.add.graphics();

    const buildingTypes = Object.keys(buildingData);

    for (const type of buildingTypes) {
      const config = buildingData[type as keyof typeof buildingData];
      const color = Phaser.Display.Color.HexStringToColor(config.color);

      gfx.clear();

      if (type === 'wall') {
        SpriteGenerator.drawWall(gfx, color.color);
        gfx.generateTexture(`building_${type}`, 16, 16);
      } else if (type === 'road') {
        SpriteGenerator.drawRoad(gfx, color.color);
        gfx.generateTexture(`building_${type}`, 16, 16);
      } else if (type === 'marketplace') {
        const size = config.size;
        const pxW = size.x * 16;
        const pxH = size.y * 16;
        SpriteGenerator.drawMarketplace(gfx, color.color, pxW, pxH);
        gfx.generateTexture(`building_${type}`, pxW, pxH);
      } else {
        const size = config.size;
        const pxW = size.x * 16;
        const pxH = size.y * 16;
        SpriteGenerator.drawBuilding(gfx, color.color, pxW, pxH);
        gfx.generateTexture(`building_${type}`, pxW, pxH);
      }
    }

    gfx.destroy();
  }

  // ── Creature drawing helpers ──────────────────────────────────────

  private static drawHumanoid(gfx: Phaser.GameObjects.Graphics, color: number): void {
    // Head (3x3 at center top)
    gfx.fillStyle(color);
    gfx.fillRect(3, 0, 3, 3);

    // Eyes (two dark pixels)
    gfx.fillStyle(0x000000);
    gfx.fillRect(3, 1, 1, 1);
    gfx.fillRect(5, 1, 1, 1);

    // Body (4x4)
    gfx.fillStyle(color);
    gfx.fillRect(2, 3, 4, 4);

    // Legs (two 1x4 columns)
    gfx.fillStyle(0x333333);
    gfx.fillRect(2, 7, 2, 4);
    gfx.fillRect(5, 7, 2, 4);

    // Arms (1x3 on each side)
    gfx.fillStyle(color);
    gfx.fillRect(1, 4, 1, 3);
    gfx.fillRect(6, 4, 1, 3);
  }

  private static drawWolf(gfx: Phaser.GameObjects.Graphics, color: number): void {
    // Body (horizontal rectangle)
    gfx.fillStyle(color);
    gfx.fillRect(2, 3, 8, 3);

    // Head
    gfx.fillStyle(color);
    gfx.fillRect(0, 2, 3, 3);

    // Eye
    gfx.fillStyle(0xff0000);
    gfx.fillRect(1, 3, 1, 1);

    // Legs
    gfx.fillStyle(0x444444);
    gfx.fillRect(2, 6, 1, 2);
    gfx.fillRect(4, 6, 1, 2);
    gfx.fillRect(7, 6, 1, 2);
    gfx.fillRect(9, 6, 1, 2);

    // Tail
    gfx.fillStyle(color);
    gfx.fillRect(10, 2, 2, 1);
  }

  private static drawDeer(gfx: Phaser.GameObjects.Graphics, color: number): void {
    // Body
    gfx.fillStyle(color);
    gfx.fillRect(2, 4, 6, 3);

    // Head
    gfx.fillStyle(color);
    gfx.fillRect(0, 3, 2, 3);

    // Eye
    gfx.fillStyle(0x000000);
    gfx.fillRect(0, 4, 1, 1);

    // Antlers
    gfx.fillStyle(0x8b4513);
    gfx.fillRect(0, 1, 1, 2);
    gfx.fillRect(2, 1, 1, 2);

    // Legs
    gfx.fillStyle(0x5d4e37);
    gfx.fillRect(2, 7, 1, 3);
    gfx.fillRect(4, 7, 1, 3);
    gfx.fillRect(6, 7, 1, 3);
    gfx.fillRect(8, 7, 1, 3);
  }

  private static drawChicken(gfx: Phaser.GameObjects.Graphics, color: number): void {
    // Body
    gfx.fillStyle(color);
    gfx.fillRect(1, 2, 4, 3);

    // Head
    gfx.fillStyle(color);
    gfx.fillRect(0, 0, 2, 2);

    // Beak
    gfx.fillStyle(0xff8800);
    gfx.fillRect(0, 1, 1, 1);

    // Eye
    gfx.fillStyle(0x000000);
    gfx.fillRect(1, 0, 1, 1);

    // Legs
    gfx.fillStyle(0xff8800);
    gfx.fillRect(2, 5, 1, 1);
    gfx.fillRect(4, 5, 1, 1);
  }

  private static drawBear(gfx: Phaser.GameObjects.Graphics, color: number): void {
    // Body (large quadruped, 10x4 core body)
    gfx.fillStyle(color);
    gfx.fillRect(2, 3, 10, 4);

    // Head (3x3 block at front-left)
    gfx.fillStyle(color);
    gfx.fillRect(0, 2, 3, 3);

    // Small ears (two 1x1 blocks on top of head)
    gfx.fillStyle(color);
    gfx.fillRect(0, 1, 1, 1);
    gfx.fillRect(2, 1, 1, 1);

    // Dark eyes (two 1x1 black pixels)
    gfx.fillStyle(0x000000);
    gfx.fillRect(0, 3, 1, 1);
    gfx.fillRect(2, 3, 1, 1);

    // Snout (lighter center pixel)
    gfx.fillStyle(0x8b7355);
    gfx.fillRect(1, 3, 1, 1);

    // Legs (four thick stumps)
    gfx.fillStyle(0x3d2e1f);
    gfx.fillRect(2, 7, 2, 3);
    gfx.fillRect(5, 7, 2, 3);
    gfx.fillRect(8, 7, 2, 3);
    gfx.fillRect(11, 7, 2, 3);

    // Tail
    gfx.fillStyle(color);
    gfx.fillRect(12, 3, 1, 1);
  }

  private static drawFish(gfx: Phaser.GameObjects.Graphics, color: number): void {
    // Body (6x2 core, horizontal)
    gfx.fillStyle(color);
    gfx.fillRect(1, 1, 6, 2);

    // Head taper
    gfx.fillStyle(color);
    gfx.fillRect(0, 1, 1, 2);

    // Tail (V-shape)
    gfx.fillStyle(color);
    gfx.fillRect(7, 0, 1, 1);
    gfx.fillRect(7, 3, 1, 1);

    // Eye
    gfx.fillStyle(0x000000);
    gfx.fillRect(1, 1, 1, 1);

    // Belly highlight
    gfx.fillStyle(0x5dade2);
    gfx.fillRect(2, 2, 3, 1);
  }

  private static drawOrc(gfx: Phaser.GameObjects.Graphics, color: number): void {
    // Head (4x3 — wider than normal humanoid)
    gfx.fillStyle(color);
    gfx.fillRect(3, 0, 4, 3);

    // Eyes (two dark pixels)
    gfx.fillStyle(0x000000);
    gfx.fillRect(3, 1, 1, 1);
    gfx.fillRect(6, 1, 1, 1);

    // Tusks (two small white pixels below eyes)
    gfx.fillStyle(0xffffff);
    gfx.fillRect(3, 3, 1, 1);
    gfx.fillRect(6, 3, 1, 1);

    // Body (5x4 — wider)
    gfx.fillStyle(color);
    gfx.fillRect(2, 4, 6, 3);

    // Legs (two 2x4 columns)
    gfx.fillStyle(0x333333);
    gfx.fillRect(2, 7, 2, 5);
    gfx.fillRect(6, 7, 2, 5);

    // Arms (1x3 on each side)
    gfx.fillStyle(color);
    gfx.fillRect(1, 4, 1, 3);
    gfx.fillRect(8, 4, 1, 3);
  }

  // ── Military role overlay helpers ──────────────────────────────────

  /** Warrior overlay: shield (gray square on left side) */
  private static drawWarriorOverlay(gfx: Phaser.GameObjects.Graphics, width: number): void {
    gfx.fillStyle(0x888888);
    // Shield on left arm
    gfx.fillRect(0, 3, 1, 4);
    // Sword on right
    gfx.fillStyle(0xcccccc);
    gfx.fillRect(width - 1, 2, 1, 6);
  }

  /** Archer overlay: bow (curved line on right side) */
  private static drawArcherOverlay(gfx: Phaser.GameObjects.Graphics, width: number): void {
    gfx.fillStyle(0x8b4513);
    // Bow on right arm
    gfx.fillRect(width, 3, 1, 5);
    // Bowstring
    gfx.fillStyle(0xdddddd);
    gfx.fillRect(width + 1, 4, 1, 3);
  }

  /** Mage overlay: staff (long pixel on right hand) */
  private static drawMageOverlay(gfx: Phaser.GameObjects.Graphics, _width: number): void {
    gfx.fillStyle(0x9b59b6);
    // Staff extending from right hand upward
    gfx.fillRect(7, 0, 1, 8);
    // Staff orb at top
    gfx.fillStyle(0x00ffff);
    gfx.fillRect(6, 0, 3, 2);
  }

  // ── Equipment overlay helpers ───────────────────────────────────────

  /**
   * Generates equipment overlay textures for humanoid creatures.
   * Textures: 'equip_sword', 'equip_bow', 'equip_staff',
   *           'armor_leather', 'armor_chain', 'armor_plate'
   */
  static generateEquipmentOverlays(scene: Phaser.Scene): void {
    const gfx = scene.add.graphics();

    // Sword: bright line on right hand
    gfx.clear();
    gfx.fillStyle(0xcccccc);
    gfx.fillRect(7, 1, 1, 5);
    gfx.fillStyle(0xffffff);
    gfx.fillRect(7, 2, 1, 3);
    gfx.generateTexture('equip_sword', 8, 12);

    // Bow: curved line on right side
    gfx.clear();
    gfx.fillStyle(0x8b4513);
    gfx.fillRect(7, 2, 1, 5);
    gfx.fillStyle(0xdddddd);
    gfx.fillRect(8, 3, 1, 3);
    gfx.generateTexture('equip_bow', 8, 12);

    // Staff: long pixel with orb
    gfx.clear();
    gfx.fillStyle(0x9b59b6);
    gfx.fillRect(7, 0, 1, 8);
    gfx.fillStyle(0x00ffff);
    gfx.fillRect(6, 0, 3, 2);
    gfx.generateTexture('equip_staff', 8, 12);

    // Leather armor: slightly darker body overlay
    gfx.clear();
    gfx.fillStyle(0x8b6914);
    gfx.fillRect(2, 3, 4, 4);
    gfx.generateTexture('armor_leather', 8, 12);

    // Chain armor: metallic body overlay
    gfx.clear();
    gfx.fillStyle(0xaaaaaa);
    gfx.fillRect(2, 3, 4, 4);
    gfx.generateTexture('armor_chain', 8, 12);

    // Plate armor: full metal body overlay
    gfx.clear();
    gfx.fillStyle(0xdddddd);
    gfx.fillRect(1, 3, 6, 4);
    gfx.generateTexture('armor_plate', 8, 12);

    gfx.destroy();
  }

  // ── Building drawing helpers ──────────────────────────────────────

  private static drawBuilding(
    gfx: Phaser.GameObjects.Graphics,
    color: number,
    w: number,
    h: number,
  ): void {
    // Base/wall
    gfx.fillStyle(color);
    gfx.fillRect(0, h * 0.3, w, h * 0.7);

    // Roof (darker triangle approximation using rectangle)
    const darker = Phaser.Display.Color.IntegerToColor(color).darken(0.3).color;
    gfx.fillStyle(darker);
    gfx.fillRect(1, 0, w - 2, h * 0.35);

    // Door
    gfx.fillStyle(0x4a2800);
    gfx.fillRect(w * 0.35, h * 0.6, w * 0.3, h * 0.4);

    // Window
    gfx.fillStyle(0x87ceeb);
    gfx.fillRect(w * 0.1, h * 0.4, w * 0.15, w * 0.15);
    gfx.fillRect(w * 0.75, h * 0.4, w * 0.15, w * 0.15);
  }

  private static drawWall(gfx: Phaser.GameObjects.Graphics, color: number): void {
    gfx.fillStyle(color);
    gfx.fillRect(0, 0, 16, 16);

    // Stone texture lines
    const lighter = Phaser.Display.Color.IntegerToColor(color).lighten(0.2).color;
    gfx.fillStyle(lighter);
    gfx.fillRect(0, 4, 7, 1);
    gfx.fillRect(9, 4, 7, 1);
    gfx.fillRect(4, 8, 8, 1);
    gfx.fillRect(0, 12, 6, 1);
    gfx.fillRect(8, 12, 8, 1);
  }

  private static drawRoad(gfx: Phaser.GameObjects.Graphics, color: number): void {
    gfx.fillStyle(color);
    gfx.fillRect(0, 0, 16, 16);

    // Path markings
    const lighter = Phaser.Display.Color.IntegerToColor(color).lighten(0.15).color;
    gfx.fillStyle(lighter);
    gfx.fillRect(6, 2, 4, 2);
    gfx.fillRect(6, 8, 4, 2);
    gfx.fillRect(6, 14, 4, 2);
  }

  private static drawMarketplace(
    gfx: Phaser.GameObjects.Graphics,
    color: number,
    w: number,
    h: number,
  ): void {
    // Wooden base (light brown)
    gfx.fillStyle(0xc4a35a);
    gfx.fillRect(0, h * 0.3, w, h * 0.7);

    // Yellow/gold awning (stall canopy)
    gfx.fillStyle(color);
    gfx.fillRect(0, 0, w, h * 0.35);

    // Awning stripe detail
    const darker = Phaser.Display.Color.IntegerToColor(color).darken(0.2).color;
    gfx.fillStyle(darker);
    for (let sx = 0; sx < w; sx += 8) {
      gfx.fillRect(sx, 0, 4, h * 0.35);
    }

    // Counter/stall front
    gfx.fillStyle(0x8b6914);
    gfx.fillRect(w * 0.1, h * 0.5, w * 0.8, h * 0.15);

    // Goods on display (small colored dots)
    gfx.fillStyle(0x27ae60); // green = herbs/food
    gfx.fillRect(w * 0.2, h * 0.55, 3, 3);
    gfx.fillStyle(0x95a5a6); // gray = stone/iron
    gfx.fillRect(w * 0.4, h * 0.55, 3, 3);
    gfx.fillStyle(0xf39c12); // orange = gold
    gfx.fillRect(w * 0.6, h * 0.55, 3, 3);
    gfx.fillStyle(0x3498db); // blue = crystal
    gfx.fillRect(w * 0.8, h * 0.55, 3, 3);

    // Support posts
    gfx.fillStyle(0x5d4e37);
    gfx.fillRect(w * 0.05, h * 0.15, 3, h * 0.85);
    gfx.fillRect(w * 0.9, h * 0.15, 3, h * 0.85);
  }
}
