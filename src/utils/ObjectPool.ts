export class ObjectPool<T> {
  private pool: T[];
  private factory: () => T;
  private resetFn: (obj: T) => void;

  constructor(factory: () => T, resetFn: (obj: T) => void, initialSize: number = 0) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.pool = [];

    for (let i = 0; i < initialSize; i++) {
      const obj = this.factory();
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
  }

  get size(): number {
    return this.pool.length;
  }

  get available(): number {
    return this.pool.length;
  }
}
