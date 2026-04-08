import { createWorld, type World } from 'bitecs';

export type GameWorld = World<{
  time: { delta: number; elapsed: number };
}>;

export class ECSHost {
  private static instance: ECSHost | null = null;
  world: GameWorld;
  private systems: Array<(world: GameWorld, delta: number) => void> = [];

  private constructor() {
    this.world = createWorld({
      time: { delta: 0, elapsed: 0 },
    });
  }

  static getInstance(): ECSHost {
    if (!ECSHost.instance) {
      ECSHost.instance = new ECSHost();
    }
    return ECSHost.instance;
  }

  registerSystem(system: (world: GameWorld, delta: number) => void): void {
    this.systems.push(system);
  }

  tick(delta: number): void {
    for (const system of this.systems) {
      system(this.world, delta);
    }
  }

  static reset(): void {
    ECSHost.instance = null;
  }
}
