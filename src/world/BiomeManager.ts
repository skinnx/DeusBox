import { BiomeType, TileType } from '@/core/Types.js';
import biomesData from '@/data/biomes.json';

interface BiomeConfig {
  elevationRange: [number, number];
  moistureRange: [number, number];
  baseColor: string;
  passable: boolean;
  movementCost: number;
}

type BiomeConfigs = Record<string, BiomeConfig>;

export class BiomeManager {
  private configs: BiomeConfigs;
  private colorCache: Map<BiomeType, number>;
  private biomeOrder: string[];

  constructor() {
    this.configs = biomesData as unknown as BiomeConfigs;
    this.colorCache = new Map();
    // Order matters: more specific ranges first
    this.biomeOrder = [
      'snow',
      'mountain',
      'denseForest',
      'forest',
      'desert',
      'tundra',
      'plains',
      'beach',
      'ocean',
    ];
  }

  getBiome(elevation: number, moisture: number): BiomeType {
    for (const key of this.biomeOrder) {
      const cfg = this.configs[key];
      if (cfg === undefined) continue;
      const [eMin, eMax] = cfg.elevationRange;
      const [mMin, mMax] = cfg.moistureRange;
      if (elevation >= eMin && elevation < eMax && moisture >= mMin && moisture < mMax) {
        return this.keyToBiomeType(key);
      }
    }
    // Fallback: if elevation is exactly 1.0, snow
    if (elevation >= 0.9) {
      return BiomeType.Mountain;
    }
    return BiomeType.Ocean;
  }

  getBiomeColor(biome: BiomeType): number {
    const cached = this.colorCache.get(biome);
    if (cached !== undefined) {
      return cached;
    }
    const key = this.biomeTypeToKey(biome);
    const cfg = this.configs[key];
    const color = cfg ? this.hexToNumber(cfg.baseColor) : 0xff00ff;
    this.colorCache.set(biome, color);
    return color;
  }

  getBiomeTileType(biome: BiomeType): TileType {
    switch (biome) {
      case BiomeType.Ocean:
        return TileType.DeepWater;
      case BiomeType.Beach:
        return TileType.Sand;
      case BiomeType.Plains:
        return TileType.Grass;
      case BiomeType.Forest:
        return TileType.Forest;
      case BiomeType.DenseForest:
        return TileType.DenseForest;
      case BiomeType.Desert:
        return TileType.Desert;
      case BiomeType.Tundra:
        return TileType.Tundra;
      case BiomeType.Mountain:
        return TileType.Mountain;
      case BiomeType.Volcanic:
        return TileType.Lava;
      default:
        return TileType.Grass;
    }
  }

  getMovementCost(biome: BiomeType): number {
    const key = this.biomeTypeToKey(biome);
    const cfg = this.configs[key];
    return cfg ? cfg.movementCost : 1;
  }

  isPassable(biome: BiomeType): boolean {
    const key = this.biomeTypeToKey(biome);
    const cfg = this.configs[key];
    return cfg ? cfg.passable : false;
  }

  private keyToBiomeType(key: string): BiomeType {
    const map: Record<string, BiomeType> = {
      ocean: BiomeType.Ocean,
      beach: BiomeType.Beach,
      plains: BiomeType.Plains,
      forest: BiomeType.Forest,
      denseForest: BiomeType.DenseForest,
      desert: BiomeType.Desert,
      tundra: BiomeType.Tundra,
      mountain: BiomeType.Mountain,
      snow: BiomeType.Mountain, // snow biome maps to Mountain biome type
    };
    return map[key] ?? BiomeType.Ocean;
  }

  private biomeTypeToKey(biome: BiomeType): string {
    const map: Record<string, string> = {
      [BiomeType.Ocean]: 'ocean',
      [BiomeType.Beach]: 'beach',
      [BiomeType.Plains]: 'plains',
      [BiomeType.Forest]: 'forest',
      [BiomeType.DenseForest]: 'denseForest',
      [BiomeType.Desert]: 'desert',
      [BiomeType.Tundra]: 'tundra',
      [BiomeType.Mountain]: 'mountain',
      [BiomeType.Volcanic]: 'ocean', // no volcanic in json, fallback
    };
    return map[biome] ?? 'ocean';
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }
}
