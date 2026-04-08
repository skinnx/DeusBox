import { TileType } from '@/core/Types.js';

const TILE_COLORS: Record<string, number> = {
  [TileType.DeepWater]: 0x1a5276,
  [TileType.ShallowWater]: 0x2e86c1,
  [TileType.Sand]: 0xf9e79f,
  [TileType.Grass]: 0x82e0aa,
  [TileType.Forest]: 0x27ae60,
  [TileType.DenseForest]: 0x1e8449,
  [TileType.Mountain]: 0x7f8c8d,
  [TileType.Snow]: 0xecf0f1,
  [TileType.Desert]: 0xf0b27a,
  [TileType.Tundra]: 0xd5dbdb,
  [TileType.Lava]: 0xe74c3c,
  [TileType.Void]: 0x000000,
};

export class TilesetManager {
  getTileColor(tileType: TileType): number {
    return TILE_COLORS[tileType] ?? 0xff00ff;
  }

  colorToCSS(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
  }
}
