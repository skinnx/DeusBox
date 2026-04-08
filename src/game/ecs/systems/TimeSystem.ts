import type { GameWorld } from '../ECSHost.js';

/**
 * Creates a system that updates world.time with delta and elapsed values.
 */
export function createTimeSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    world.time.delta = delta;
    world.time.elapsed += delta;
  };
}
