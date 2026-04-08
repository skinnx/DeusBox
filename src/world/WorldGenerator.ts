import { TileType, BiomeType } from '@/core/Types.js';
import { WORLD_TILES_X, WORLD_TILES_Y } from '@/core/Constants.js';
import { NoiseGenerator } from '@/utils/Noise.js';
import { clamp } from '@/utils/MathUtils.js';
import { TileMap } from '@/world/TileMap.js';
import { BiomeManager } from '@/world/BiomeManager.js';

export class WorldGenerator {
  private biomeManager: BiomeManager;

  constructor(biomeManager: BiomeManager) {
    this.biomeManager = biomeManager;
  }

  generate(seed: number): TileMap {
    const noise = new NoiseGenerator(seed);
    const moistureNoise = new NoiseGenerator(seed + 1000);
    const tileMap = new TileMap(WORLD_TILES_X, WORLD_TILES_Y);

    // Pass 1: Generate elevation and moisture
    for (let y = 0; y < WORLD_TILES_Y; y++) {
      for (let x = 0; x < WORLD_TILES_X; x++) {
        // Elevation: combine ridged noise (mountain ridges) with fbm (general terrain)
        const scaleLarge = 0.008;
        const scaleDetail = 0.03;
        const nx = x * scaleLarge;
        const ny = y * scaleLarge;

        const ridgedValue = noise.ridged(nx, ny, 6);
        const fbmValue = noise.fbm(nx, ny, 6, 2.0, 0.5);
        const detailValue = noise.fbm(x * scaleDetail, y * scaleDetail, 3, 2.0, 0.5);

        // Blend: ridged for mountain ridges, fbm for rolling terrain
        let elevation = 0.5 * fbmValue + 0.3 * ridgedValue + 0.2 * detailValue;

        // Normalize from [-1, 1] to [0, 1]
        elevation = clamp((elevation + 1) * 0.5, 0, 1);

        // Island mask: reduce elevation near edges to create ocean border
        const edgeX = Math.min(x, WORLD_TILES_X - 1 - x) / (WORLD_TILES_X * 0.15);
        const edgeY = Math.min(y, WORLD_TILES_Y - 1 - y) / (WORLD_TILES_Y * 0.15);
        const edgeDist = Math.min(edgeX, edgeY);
        if (edgeDist < 1) {
          elevation *= edgeDist * edgeDist; // quadratic falloff
        }

        elevation = clamp(elevation, 0, 0.9999);
        tileMap.setElevation(x, y, elevation);

        // Moisture: fbm noise at different scale
        const mScale = 0.01;
        const moisture = clamp(
          (moistureNoise.fbm(x * mScale, y * mScale, 4, 2.0, 0.5) + 1) * 0.5,
          0,
          0.9999,
        );
        tileMap.setMoisture(x, y, moisture);
      }
    }

    // Pass 2: Assign biomes and tile types
    for (let y = 0; y < WORLD_TILES_Y; y++) {
      for (let x = 0; x < WORLD_TILES_X; x++) {
        const elevation = tileMap.getElevation(x, y);
        const moisture = tileMap.getMoisture(x, y);
        const biome = this.biomeManager.getBiome(elevation, moisture);
        let tileType = this.biomeManager.getBiomeTileType(biome);

        // Override: high elevation with low moisture at edge of mountains = snow peaks
        if (elevation >= 0.9) {
          tileType = TileType.Snow;
        }

        // Override: deep ocean vs shallow water based on elevation
        if (biome === BiomeType.Ocean) {
          tileType = elevation < 0.2 ? TileType.DeepWater : TileType.ShallowWater;
        }

        tileMap.setTile(x, y, tileType);
      }
    }

    return tileMap;
  }
}
