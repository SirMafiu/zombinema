export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;

  constructor(
    create: () => T,
    reset: (obj: T) => void,
    initialSize: number = 0,
  ) {
    this.createFn = create;
    this.resetFn = reset;

    for (let i = 0; i < initialSize; i++) {
      const obj = this.createFn();
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}
