export interface EventMap {
  'game:boot': undefined;
  'game:ready': undefined;
  'scene:change': { scene: string; data?: Record<string, unknown> };
  'entity:spawned': { entityId: number; type: string };
  'entity:destroyed': { entityId: number };
  'need:changed': { entityId: number; need: string; value: number };
  'damage:dealt': { entityId: number; amount: number; source: string };
  'tile:changed': { tileX: number; tileY: number; fromType: string; toType: string };
  'disaster:start': { type: string; centerX: number; centerY: number; radius: number };
  'disaster:end': { type: string };
  'relationship:changed': { entityId: number; targetId: number; value: number; type: string };
  'storyteller:event': { type: string; data: Record<string, unknown> };
  'entity:hover': { entityId: number; worldX: number; worldY: number };
  'entity:click': { entityId: number; button: string };
  'selection:changed': { selectedIds: number[] };
  'contextmenu:action': { action: string; entityId: number; data?: Record<string, unknown> };
}

type EventCallback<T> = T extends undefined ? () => void : (data: T) => void;

type EventKey = keyof EventMap;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<EventKey, Set<EventCallback<never>>>;

  private constructor() {
    this.listeners = new Map();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on<K extends EventKey>(event: K, callback: EventCallback<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<never>);
  }

  off<K extends EventKey>(event: K, callback: EventCallback<EventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback<never>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<K extends EventKey>(
    event: K,
    ...args: EventMap[K] extends undefined ? [] : [EventMap[K]]
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const callback of set) {
        if (args.length === 0) {
          (callback as () => void)();
        } else {
          (callback as (data: EventMap[K]) => void)(args[0]);
        }
      }
    }
  }

  removeAllListeners(event?: EventKey): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const eventBus = EventBus.getInstance();
