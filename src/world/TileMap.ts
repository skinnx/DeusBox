import { TileType } from '@/core/Types.js';
import { WORLD_TILES_X, WORLD_TILES_Y } from '@/core/Constants.js';

/** Cached TileType values array — built once, avoids Object.values() per call. */
const TILE_TYPES = Object.values(TileType);

/** Cached TileType name → index map — built once, avoids indexOf() per call. */
const TILE_TYPE_INDEX = new Map<string, number>(TILE_TYPES.map((t, i) => [t, i]));

export class TileMap {
  readonly width: number;
  readonly height: number;
  private tiles: Uint8Array;
  private elevationMap: Float32Array;
  private moistureMap: Float32Array;

  constructor(width: number = WORLD_TILES_X, height: number = WORLD_TILES_Y) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.tiles = new Uint8Array(size);
    this.elevationMap = new Float32Array(size);
    this.moistureMap = new Float32Array(size);
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getTile(x: number, y: number): TileType {
    if (!this.isInBounds(x, y)) {
      return TileType.Void;
    }
    const value = this.tiles[this.index(x, y)];
    return TILE_TYPES[value] ?? TileType.Void;
  }

  setTile(x: number, y: number, type: TileType): void {
    if (!this.isInBounds(x, y)) {
      return;
    }
    const idx = TILE_TYPE_INDEX.get(type);
    if (idx !== undefined) {
      this.tiles[this.index(x, y)] = idx;
    }
  }

  getElevation(x: number, y: number): number {
    if (!this.isInBounds(x, y)) {
      return 0;
    }
    return this.elevationMap[this.index(x, y)];
  }

  setElevation(x: number, y: number, value: number): void {
    if (!this.isInBounds(x, y)) {
      return;
    }
    this.elevationMap[this.index(x, y)] = value;
  }

  getMoisture(x: number, y: number): number {
    if (!this.isInBounds(x, y)) {
      return 0;
    }
    return this.moistureMap[this.index(x, y)];
  }

  setMoisture(x: number, y: number, value: number): void {
    if (!this.isInBounds(x, y)) {
      return;
    }
    this.moistureMap[this.index(x, y)] = value;
  }

  getTilesInRect(startX: number, startY: number, w: number, h: number): TileType[] {
    const result: TileType[] = [];
    for (let y = startY; y < startY + h; y++) {
      for (let x = startX; x < startX + w; x++) {
        result.push(this.getTile(x, y));
      }
    }
    return result;
  }
}
