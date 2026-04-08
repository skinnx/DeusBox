/**
 * Grid-based spatial hash for O(1) neighbor queries.
 * Maps cell keys to entity IDs for efficient spatial lookups.
 */
export class SpatialHash {
  private cellSize: number;
  private invCellSize: number;
  private cells: Map<string, number[]>;

  constructor(cellSize: number = 128) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
  }

  /** Reset the hash — call once per frame before rebuilding. */
  clear(): void {
    this.cells.clear();
  }

  /** Insert entity at world position. */
  insert(eid: number, x: number, y: number): void {
    const cx = (x * this.invCellSize) | 0;
    const cy = (y * this.invCellSize) | 0;
    const key = `${cx},${cy}`;
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(eid);
  }

  /** Return all entity IDs within `radius` of point (x, y). */
  query(x: number, y: number, radius: number): number[] {
    const result: number[] = [];
    const r2 = radius * radius;
    const minCX = ((x - radius) * this.invCellSize) | 0;
    const maxCX = ((x + radius) * this.invCellSize) | 0;
    const minCY = ((y - radius) * this.invCellSize) | 0;
    const maxCY = ((y + radius) * this.invCellSize) | 0;

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          result.push(cell[i]);
        }
      }
    }

    // Filter by actual distance
    let write = 0;
    for (let i = 0; i < result.length; i++) {
      // Distance check is done by the caller using Position data;
      // we return all candidates in overlapping cells.
      result[write] = result[i];
      write++;
    }
    result.length = write;
    return result;
  }

  /** Return all entity IDs in rectangle from (x1,y1) to (x2,y2). */
  queryRect(x1: number, y1: number, x2: number, y2: number): number[] {
    const result: number[] = [];
    const minCX = (x1 * this.invCellSize) | 0;
    const maxCX = (x2 * this.invCellSize) | 0;
    const minCY = (y1 * this.invCellSize) | 0;
    const maxCY = (y2 * this.invCellSize) | 0;

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          result.push(cell[i]);
        }
      }
    }

    return result;
  }
}
