import { query } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Velocity from '../components/Velocity.js';
import Pathfinder from '../components/Pathfinder.js';
import type { TileMap } from '@/world/TileMap.js';
import { findPath } from '@/utils/Pathfinding.js';

/** Number of entities to process per frame (round-robin budget) */
const PROCESS_PER_FRAME = 3;

/** Distance threshold to consider "arrived" at a waypoint (pixels) */
const WAYPOINT_THRESHOLD = 4;

/**
 * Creates a pathfinding system that uses A* to navigate around obstacles.
 * Entities with Pathfinder + Position + Velocity will compute paths via A*
 * and follow waypoints. Falls back to direct-line movement if A* finds no path.
 */
export function createPathfindingSystem(
  tileMap?: TileMap,
): (world: GameWorld, delta: number) => void {
  let lastIndex = 0;

  // Per-entity path cache: entity ID → array of waypoints
  const pathCache = new Map<number, Array<{ x: number; y: number }>>();
  // Per-entity last-known target: detects target changes to invalidate stale paths
  const pathCacheTarget = new Map<number, { x: number; y: number }>();

  return (world: GameWorld, _delta: number): void => {
    const ents = query(world, [Position, Velocity, Pathfinder]);
    if (ents.length === 0) return;

    const count = Math.min(PROCESS_PER_FRAME, ents.length);

    for (let i = 0; i < count; i++) {
      const idx = (lastIndex + i) % ents.length;
      const eid = ents[idx];

      const px = Position.x[eid];
      const py = Position.y[eid];
      const tx = Pathfinder.targetX[eid];
      const ty = Pathfinder.targetY[eid];
      const speed = Pathfinder.speed[eid];

      // No speed or no target → skip
      if (speed <= 0) continue;

      // Check if target changed (need new path)
      const lastTarget = pathCacheTarget.get(eid);
      const targetChanged = !lastTarget || lastTarget.x !== tx || lastTarget.y !== ty;
      let path = pathCache.get(eid);
      if (targetChanged || !path || path.length === 0) {
        if (targetChanged) {
          pathCacheTarget.set(eid, { x: tx, y: ty });
        }
        // Compute A* path if tile map is available
        if (tileMap) {
          path = findPath(px, py, tx, ty, tileMap);
        } else {
          // Fallback: direct line
          path = [{ x: tx, y: ty }];
        }
        pathCache.set(eid, path);
      }

      if (path.length === 0) {
        // No path found (impassable) → stop
        Velocity.x[eid] = 0;
        Velocity.y[eid] = 0;
        continue;
      }

      // Follow the path: move toward the next waypoint
      const waypoint = path[0];
      const dx = waypoint.x - px;
      const dy = waypoint.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < WAYPOINT_THRESHOLD) {
        // Reached this waypoint, advance to next
        path.shift();
        if (path.length === 0) {
          // Arrived at final destination
          Velocity.x[eid] = 0;
          Velocity.y[eid] = 0;
        }
        continue;
      }

      // Set velocity toward current waypoint
      Velocity.x[eid] = (dx / dist) * speed;
      Velocity.y[eid] = (dy / dist) * speed;
    }

    // Advance round-robin index
    lastIndex = (lastIndex + count) % ents.length;

    // Clean up path cache for entities that no longer exist
    if (pathCache.size > 100) {
      const activeIds = new Set(ents);
      for (const [eid] of pathCache) {
        if (!activeIds.has(eid)) {
          pathCache.delete(eid);
        }
      }
    }
  };
}
