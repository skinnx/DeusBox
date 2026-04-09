import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Velocity from '../components/Velocity.js';
import SpriteRef from '../components/SpriteRef.js';
import { getWeatherMovementModifier } from './WeatherSystem.js';

/** Direction: 0=South, 1=West, 2=North, 3=East */
const DIR_SOUTH = 0;
const DIR_WEST = 1;
const DIR_NORTH = 2;
const DIR_EAST = 3;

/** Velocity threshold for direction tracking */
const DIR_VELOCITY_THRESHOLD = 5;

/**
 * Creates a movement system that reads Velocity and writes Position,
 * clamping to world bounds. Also updates facing direction on SpriteRef.
 */
export function createMovementSystem(
  worldWidth: number,
  worldHeight: number,
): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const weatherMod = getWeatherMovementModifier();
    const ents = query(world, [Position, Velocity]);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];
      const vx = Velocity.x[eid] * weatherMod;
      const vy = Velocity.y[eid] * weatherMod;

      Position.x[eid] += vx * seconds;
      Position.y[eid] += vy * seconds;

      // Clamp to world bounds
      Position.x[eid] = Math.max(0, Math.min(worldWidth, Position.x[eid]));
      Position.y[eid] = Math.max(0, Math.min(worldHeight, Position.y[eid]));

      // Update facing direction from velocity
      if (hasComponent(world, eid, SpriteRef)) {
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > DIR_VELOCITY_THRESHOLD) {
          const absVx = Math.abs(vx);
          const absVy = Math.abs(vy);
          if (absVx > absVy) {
            SpriteRef.direction[eid] = vx > 0 ? DIR_EAST : DIR_WEST;
          } else {
            SpriteRef.direction[eid] = vy > 0 ? DIR_SOUTH : DIR_NORTH;
          }
        }
      }
    }
  };
}
