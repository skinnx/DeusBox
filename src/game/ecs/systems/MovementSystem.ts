import { query } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Velocity from '../components/Velocity.js';

/**
 * Creates a movement system that reads Velocity and writes Position,
 * clamping to world bounds.
 */
export function createMovementSystem(
  worldWidth: number,
  worldHeight: number,
): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const ents = query(world, [Position, Velocity]);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];
      Position.x[eid] += Velocity.x[eid] * seconds;
      Position.y[eid] += Velocity.y[eid] * seconds;

      // Clamp to world bounds
      Position.x[eid] = Math.max(0, Math.min(worldWidth, Position.x[eid]));
      Position.y[eid] = Math.max(0, Math.min(worldHeight, Position.y[eid]));
    }
  };
}
