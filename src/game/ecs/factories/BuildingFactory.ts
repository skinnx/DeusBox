import { addEntity, addComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import SpriteRef from '../components/SpriteRef.js';
import Faction from '../components/Faction.js';
import { Building, Selectable } from '../components/TagComponents.js';
import { hashTextureKey } from '../systems/RenderSyncSystem.js';
import { eventBus } from '@/core/EventBus.js';

import buildingData from '@/data/buildings.json';

interface BuildingConfig {
  size: { x: number; y: number };
  color: string;
  cost: Record<string, number>;
  provides: string;
  capacity?: number;
  productionRate?: number;
  healthBonus?: number;
  movementBonus?: number;
}

type BuildingType = keyof typeof buildingData;

/**
 * Spawns a building entity with relevant components.
 * Data is loaded from buildings.json.
 *
 * @returns The entity ID of the spawned building.
 */
export function spawnBuilding(
  world: GameWorld,
  type: string,
  x: number,
  y: number,
  factionId: number = 0,
): number {
  const config = (buildingData as Record<string, BuildingConfig>)[type];
  if (!config) {
    console.warn(`[BuildingFactory] Unknown building type: ${type}`);
    return -1;
  }

  const eid = addEntity(world);

  // Position
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;

  // Health — buildings have more health
  addComponent(world, eid, Health);
  Health.current[eid] = 200;
  Health.max[eid] = 200;

  // Sprite reference
  const textureKey = `building_${type}`;
  addComponent(world, eid, SpriteRef);
  SpriteRef.textureKey[eid] = hashTextureKey(textureKey);

  // Faction
  addComponent(world, eid, Faction);
  Faction.id[eid] = factionId;
  Faction.reputation[eid] = 50;

  // Tag components
  addComponent(world, eid, Building);
  addComponent(world, eid, Selectable);

  // Fire spawn event
  eventBus.emit('entity:spawned', { entityId: eid, type });

  return eid;
}
