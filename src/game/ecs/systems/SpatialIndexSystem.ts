import { query } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Faction from '../components/Faction.js';
import { SpatialHash } from '@/utils/SpatialHash.js';

/**
 * Module-level spatial hash singleton.
 * Other systems import this directly for O(1) neighbor queries.
 */
export const spatialHash = new SpatialHash(128);

/**
 * Creates the SpatialIndex system.
 * MUST run FIRST in the pipeline — clears and rebuilds the spatial hash each frame.
 * Queries all entities with Position + Faction (covers creatures and buildings).
 */
export function createSpatialIndexSystem(): (world: GameWorld) => void {
  return (world: GameWorld): void => {
    spatialHash.clear();

    const ents = query(world, [Position, Faction]);
    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];
      spatialHash.insert(eid, Position.x[eid], Position.y[eid]);
    }
  };
}
