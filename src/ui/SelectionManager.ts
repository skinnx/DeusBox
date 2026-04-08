import { eventBus } from '@/core/EventBus.js';

const MAX_SELECTION = 50;

/**
 * Singleton that tracks currently selected entity IDs.
 * Emits 'selection:changed' via EventBus whenever the selection changes.
 */
export class SelectionManager {
  private static instance: SelectionManager | null = null;
  private selectedIds: Set<number> = new Set();

  private constructor() {}

  static getInstance(): SelectionManager {
    if (!SelectionManager.instance) {
      SelectionManager.instance = new SelectionManager();
    }
    return SelectionManager.instance;
  }

  static reset(): void {
    if (SelectionManager.instance) {
      SelectionManager.instance.deselectAll();
    }
    SelectionManager.instance = null;
  }

  select(id: number): void {
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.emitChange();
  }

  selectMultiple(ids: number[]): void {
    this.selectedIds.clear();
    const capped = ids.slice(0, MAX_SELECTION);
    for (const id of capped) {
      this.selectedIds.add(id);
    }
    this.emitChange();
  }

  addToSelection(id: number): void {
    if (this.selectedIds.size >= MAX_SELECTION) return;
    this.selectedIds.add(id);
    this.emitChange();
  }

  addMultipleToSelection(ids: number[]): void {
    const remaining = MAX_SELECTION - this.selectedIds.size;
    const capped = ids.slice(0, remaining);
    for (const id of capped) {
      this.selectedIds.add(id);
    }
    this.emitChange();
  }

  removeFromSelection(id: number): void {
    this.selectedIds.delete(id);
    this.emitChange();
  }

  deselectAll(): void {
    if (this.selectedIds.size === 0) return;
    this.selectedIds.clear();
    this.emitChange();
  }

  getSelected(): number[] {
    return Array.from(this.selectedIds);
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  getSelectionCount(): number {
    return this.selectedIds.size;
  }

  private emitChange(): void {
    eventBus.emit('selection:changed', { selectedIds: this.getSelected() });
  }
}
