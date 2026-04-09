import { eventBus } from '@/core/EventBus.js';

export interface PerformanceSnapshot {
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  entityCount: number;
  drawCalls: number;
  memoryMB: number;
  heapUsedMB: number;
  deltaMs: number;
  systemTimings: Map<string, number>;
}

const FPS_HISTORY_SIZE = 120;

class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private fpsHistory: number[] = [];
  private currentFps = 0;
  private entityCount = 0;
  private drawCalls = 0;
  private deltaMs = 0;
  private systemTimings: Map<string, number> = new Map();
  private enabled = false;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  update(fps: number, delta: number, entities: number): void {
    this.currentFps = fps;
    this.deltaMs = delta;
    this.entityCount = entities;

    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > FPS_HISTORY_SIZE) {
      this.fpsHistory.shift();
    }
  }

  setDrawCalls(count: number): void {
    this.drawCalls = count;
  }

  recordSystemTiming(name: string, ms: number): void {
    this.systemTimings.set(name, ms);
  }

  getSnapshot(): PerformanceSnapshot {
    const fps = this.currentFps;
    const history = this.fpsHistory;
    const avgFps = history.length > 0
      ? history.reduce((a, b) => a + b, 0) / history.length
      : 0;
    const minFps = history.length > 0 ? Math.min(...history) : 0;
    const maxFps = history.length > 0 ? Math.max(...history) : 0;

    let memoryMB = 0;
    let heapUsedMB = 0;
    if ('memory' in performance) {
      const mem = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      heapUsedMB = mem.usedJSHeapSize / (1024 * 1024);
      memoryMB = mem.totalJSHeapSize / (1024 * 1024);
    }

    return {
      fps,
      avgFps,
      minFps,
      maxFps,
      entityCount: this.entityCount,
      drawCalls: this.drawCalls,
      memoryMB,
      heapUsedMB,
      deltaMs: this.deltaMs,
      systemTimings: new Map(this.systemTimings),
    };
  }

  getFPSColor(): string {
    if (this.currentFps >= 55) return '#2ecc71';
    if (this.currentFps >= 30) return '#f1c40f';
    return '#e74c3c';
  }
}

export const perfMonitor = PerformanceMonitor.getInstance();
export { PerformanceMonitor };
