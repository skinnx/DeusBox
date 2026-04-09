import { TileType } from '@/core/Types.js';
import { TILE_SIZE } from '@/core/Constants.js';
import type { TileMap } from '@/world/TileMap.js';
import { BinaryHeap } from '@/utils/BinaryHeap.js';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

/** 8-directional neighbor offsets */
const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [0, -1, 1], // N
  [0, 1, 1], // S
  [-1, 0, 1], // W
  [1, 0, 1], // E
  [-1, -1, 1.414], // NW
  [1, -1, 1.414], // NE
  [-1, 1, 1.414], // SW
  [1, 1, 1.414], // SE
];

const IMPASSABLE_TILES = new Set<TileType>([
  TileType.DeepWater,
  TileType.ShallowWater,
  TileType.Lava,
  TileType.Void,
]);

/**
 * Returns a terrain movement cost multiplier.
 * Returns -1 for impassable tiles.
 */
function getTerrainCost(tile: TileType): number {
  if (IMPASSABLE_TILES.has(tile)) return -1;
  switch (tile) {
    case TileType.Mountain:
    case TileType.Snow:
      return 4;
    case TileType.Swamp:
      return 3;
    case TileType.Coral:
      return 2;
    case TileType.Forest:
    case TileType.DenseForest:
      return 2;
    case TileType.Sand:
      return 1.5;
    default:
      return 1;
  }
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  // Octile distance for 8-directional grids
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (1.414 - 1) * Math.min(dx, dy);
}

function nodeKey(x: number, y: number, width: number): number {
  return y * width + x;
}

/**
 * A* pathfinding on the tile grid.
 * Coordinates are in tile-space (not pixel-space).
 * Returns an array of tile coordinates from start to end (inclusive),
 * or an empty array if no path is found.
 */
export function findPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  tileMap: TileMap,
): Array<{ x: number; y: number }> {
  // Clamp to valid tile coords
  const sx = Math.floor(startX / TILE_SIZE);
  const sy = Math.floor(startY / TILE_SIZE);
  const ex = Math.floor(endX / TILE_SIZE);
  const ey = Math.floor(endY / TILE_SIZE);

  if (!tileMap.isInBounds(sx, sy) || !tileMap.isInBounds(ex, ey)) {
    return [];
  }

  // If start or end is impassable, no path
  const endTile = tileMap.getTile(ex, ey);
  if (getTerrainCost(endTile) < 0) return [];

  const width = tileMap.width;
  const closed = new Set<number>();
  const openMap = new Map<number, PathNode>();
  const openHeap = new BinaryHeap<PathNode>((n) => n.f);

  const startNode: PathNode = {
    x: sx,
    y: sy,
    g: 0,
    h: heuristic(sx, sy, ex, ey),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openHeap.push(startNode);
  openMap.set(nodeKey(sx, sy, width), startNode);

  const maxIterations = 10000;
  let iterations = 0;

  while (openHeap.size > 0 && iterations < maxIterations) {
    iterations++;
    const current = openHeap.pop()!;

    if (current.x === ex && current.y === ey) {
      // Reconstruct path
      const path: Array<{ x: number; y: number }> = [];
      let node: PathNode | null = current;
      while (node !== null) {
        path.unshift({
          x: node.x * TILE_SIZE + TILE_SIZE / 2,
          y: node.y * TILE_SIZE + TILE_SIZE / 2,
        });
        node = node.parent;
      }
      return path;
    }

    const currentKey = nodeKey(current.x, current.y, width);
    closed.add(currentKey);

    for (const [dx, dy, moveCost] of NEIGHBORS) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (!tileMap.isInBounds(nx, ny)) continue;

      const nKey = nodeKey(nx, ny, width);
      if (closed.has(nKey)) continue;

      const tile = tileMap.getTile(nx, ny);
      const terrain = getTerrainCost(tile);
      if (terrain < 0) continue;

      const g = current.g + moveCost * terrain;
      const existing = openMap.get(nKey);

      if (existing !== undefined) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + existing.h;
          existing.parent = current;
        }
      } else {
        const h = heuristic(nx, ny, ex, ey);
        const neighbor: PathNode = { x: nx, y: ny, g, h, f: g + h, parent: current };
        openHeap.push(neighbor);
        openMap.set(nKey, neighbor);
      }
    }
  }

  return []; // No path found
}
