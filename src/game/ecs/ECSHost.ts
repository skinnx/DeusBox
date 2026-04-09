import { createWorld, type World } from 'bitecs';
import { perfMonitor } from '@/core/PerformanceMonitor.js';

export type GameWorld = World<{
  time: { delta: number; elapsed: number };
}>;

interface SystemEntry {
  name: string;
  fn: (world: GameWorld, delta: number) => void;
}

export class ECSHost {
  private static instance: ECSHost | null = null;
  world: GameWorld;
  private systems: SystemEntry[] = [];
  private profiling = false;

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

  registerSystem(system: (world: GameWorld, delta: number) => void, name?: string): void {
    const sysName = name ?? system.name ?? `system_${this.systems.length}`;
    this.systems.push({ name: sysName, fn: system });
  }

  clearSystems(): void {
    this.systems.length = 0;
  }

  setProfiling(enabled: boolean): void {
    this.profiling = enabled;
  }

  tick(delta: number): void {
    if (this.profiling) {
      for (const sys of this.systems) {
        const start = performance.now();
        sys.fn(this.world, delta);
        const elapsed = performance.now() - start;
        perfMonitor.recordSystemTiming(sys.name, elapsed);
      }
    } else {
      for (const sys of this.systems) {
        sys.fn(this.world, delta);
      }
    }
  }

  getSystemCount(): number {
    return this.systems.length;
  }

  getSystemNames(): string[] {
    return this.systems.map(s => s.name);
  }

  static reset(): void {
    ECSHost.instance = null;
  }
}
