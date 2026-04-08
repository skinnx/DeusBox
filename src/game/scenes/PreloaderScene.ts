import Phaser from 'phaser';

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload(): void {
    this.createPlaceholderTextures();
  }

  create(): void {
    console.log('[PreloaderScene] Assets ready');
    this.scene.launch('MainMenu');
  }

  private createPlaceholderTextures(): void {
    const gfx = this.add.graphics();

    // White pixel texture
    gfx.fillStyle(0xffffff);
    gfx.fillRect(0, 0, 1, 1);
    gfx.generateTexture('__white', 1, 1);
    gfx.clear();

    // Tile textures for each biome color
    const tileColors: Record<string, number> = {
      deepWater: 0x1a5276,
      shallowWater: 0x2e86c1,
      sand: 0xf9e79f,
      grass: 0x82e0aa,
      forest: 0x27ae60,
      denseForest: 0x1e8449,
      mountain: 0x7f8c8d,
      snow: 0xecf0f1,
      desert: 0xf0b27a,
      tundra: 0xd5dbdb,
      lava: 0xe74c3c,
    };

    for (const [name, color] of Object.entries(tileColors)) {
      gfx.fillStyle(color);
      gfx.fillRect(0, 0, 32, 32);
      gfx.generateTexture(`tile_${name}`, 32, 32);
      gfx.clear();
    }

    // Entity placeholder textures
    const entityColors: Record<string, number> = {
      human: 0xe74c3c,
      elf: 0x2ecc71,
      dwarf: 0xe67e22,
      orc: 0x8e44ad,
      wolf: 0x7f8c8d,
      deer: 0xa0522d,
      chicken: 0xf1c40f,
      bear: 0x5d4e37,
      fish: 0x3498db,
    };

    for (const [name, color] of Object.entries(entityColors)) {
      gfx.fillStyle(color);
      gfx.fillRect(0, 0, 16, 16);
      gfx.generateTexture(`entity_${name}`, 16, 16);
      gfx.clear();
    }

    // Building placeholder textures
    const buildingColors: Record<string, number> = {
      house: 0xc0392b,
      farm: 0xf39c12,
      warehouse: 0x95a5a6,
      barracks: 0x7f8c8d,
      temple: 0x9b59b6,
      wall: 0x5d6d7e,
      road: 0xd4a574,
    };

    for (const [name, color] of Object.entries(buildingColors)) {
      gfx.fillStyle(color);
      gfx.fillRect(0, 0, 32, 32);
      gfx.generateTexture(`building_${name}`, 32, 32);
      gfx.clear();
    }

    gfx.destroy();
  }
}
