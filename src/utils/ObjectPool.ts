export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 0, maxSize: number = 1000) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  prewarm(count: number): void {
    const toCreate = Math.min(count, this.maxSize - this.pool.length);
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.factory());
    }
  }

  get size(): number {
    return this.pool.length;
  }

  clear(): void {
    this.pool.length = 0;
  }
}

interface PooledVector {
  x: number;
  y: number;
}

export const vectorPool = new ObjectPool<PooledVector>(
  () => ({ x: 0, y: 0 }),
  (v) => { v.x = 0; v.y = 0; },
  64,
  512,
);

interface PooledArray<T> {
  items: T[];
  length: number;
}

export function createArrayPool<T>(maxSize: number = 256): ObjectPool<PooledArray<T>> {
  return new ObjectPool<PooledArray<T>>(
    () => ({ items: [], length: 0 }),
    (a) => { a.items.length = 0; a.length = 0; },
    8,
    maxSize,
  );
}
