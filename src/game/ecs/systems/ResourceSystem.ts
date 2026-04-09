import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Inventory from '../components/Inventory.js';
import ResourceSource from '../components/ResourceSource.js';
import { Humanoid } from '../components/TagComponents.js';
import { TILE_SIZE } from '@/core/Constants.js';
import { ResourceType } from '@/core/Types.js';

/**
 * Maps ResourceType enum index to Inventory field name.
 * Object.values(ResourceType) = ['Wood', 'Stone', 'Food', 'Gold', 'Iron', 'Herbs', 'Crystal']
 * Indices: 0=Wood, 1=Stone, 2=Food, 3=Gold, 4=Iron, 5=Herbs, 6=Crystal
 */
const RESOURCE_INDEX_TO_FIELD: (keyof typeof Inventory)[] = [
  'wood',
  'stone',
  'food',
  'gold',
  'iron',
  'herbs',
  'crystal',
];

/** Maximum amount a single Inventory field can hold. */
const MAX_INVENTORY_SLOT = 200;

/**
 * Creates the resource gathering system.
 * Humanoid entities near ResourceSource entities auto-gather resources
 * into their Inventory. ResourceSource.amount is depleted as resources
 * are harvested.
 */
export function createResourceSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const gatherRange = TILE_SIZE * 2;

    const sources = query(world, [Position, ResourceSource]);
    const gatherers = query(world, [Position, Inventory]);

    for (let s = 0; s < sources.length; s++) {
      const sourceEid = sources[s];
      if (ResourceSource.amount[sourceEid] <= 0) continue;

      const sx = Position.x[sourceEid];
      const sy = Position.y[sourceEid];
      const harvestTime = ResourceSource.harvestTime[sourceEid];
      if (harvestTime <= 0) continue;

      const typeIndex = Math.floor(ResourceSource.type[sourceEid]);
      const field = RESOURCE_INDEX_TO_FIELD[typeIndex];
      if (!field) continue;

      for (let g = 0; g < gatherers.length; g++) {
        const gathererEid = gatherers[g];

        // Only Humanoid entities can gather
        if (!hasComponent(world, gathererEid, Humanoid)) continue;

        const dx = Position.x[gathererEid] - sx;
        const dy = Position.y[gathererEid] - sy;
        const distSq = dx * dx + dy * dy;

        if (distSq < gatherRange * gatherRange) {
          const harvestRate = seconds / harvestTime;
          const harvested = Math.min(harvestRate, ResourceSource.amount[sourceEid]);

          // Cap inventory
          const currentAmount = Inventory[field][gathererEid];
          const canCarry = Math.max(0, MAX_INVENTORY_SLOT - currentAmount);
          const actualHarvest = Math.min(harvested, canCarry);

          if (actualHarvest > 0) {
            ResourceSource.amount[sourceEid] -= actualHarvest;
            Inventory[field][gathererEid] += actualHarvest;
          }
        }
      }
    }
  };
}

/**
 * Helper to convert a ResourceType enum value to its numeric index
 * for storage in ResourceSource.type.
 */
export function resourceTypeToIndex(type: ResourceType): number {
  return Object.values(ResourceType).indexOf(type);
}
