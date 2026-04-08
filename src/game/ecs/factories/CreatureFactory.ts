import Phaser from 'phaser';
import { addEntity, addComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Velocity from '../components/Velocity.js';
import Health from '../components/Health.js';
import Needs from '../components/Needs.js';
import SpriteRef from '../components/SpriteRef.js';
import AIStateComponent from '../components/AIState.js';
import Faction from '../components/Faction.js';
import Pathfinder from '../components/Pathfinder.js';
import { Creature, Selectable, Humanoid, Animal } from '../components/TagComponents.js';
import { hashTextureKey } from '../systems/RenderSyncSystem.js';
import { eventBus } from '@/core/EventBus.js';
import { AIState } from '@/core/Types.js';

import creatureData from '@/data/creatures.json';

interface CreatureConfig {
  speed: number;
  maxHealth: number;
  color: string;
  needs: {
    hungerDecay: number;
    restDecay: number;
    socialDecay: number;
    funDecay: number;
  };
  aiWeights: {
    food: number;
    rest: number;
    social: number;
    fun: number;
  };
}

type CreatureType = keyof typeof creatureData;

const HUMANOID_TYPES = new Set<string>(['human', 'elf', 'dwarf', 'orc']);
const ANIMAL_TYPES = new Set<string>(['wolf', 'deer', 'chicken', 'bear', 'fish']);

/**
 * Spawns a creature entity with all relevant components.
 * Data is loaded from creatures.json.
 *
 * @returns The entity ID of the spawned creature.
 */
export function spawnCreature(
  world: GameWorld,
  type: string,
  x: number,
  y: number,
  factionId: number = 0,
): number {
  const config = (creatureData as Record<string, CreatureConfig>)[type];
  if (!config) {
    console.warn(`[CreatureFactory] Unknown creature type: ${type}`);
    return -1;
  }

  const eid = addEntity(world);

  // Position
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;

  // Velocity (starts at zero)
  addComponent(world, eid, Velocity);
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;

  // Health
  addComponent(world, eid, Health);
  Health.current[eid] = config.maxHealth;
  Health.max[eid] = config.maxHealth;

  // Needs (start at 100 = fully satisfied)
  addComponent(world, eid, Needs);
  Needs.hunger[eid] = 100;
  Needs.rest[eid] = 100;
  Needs.social[eid] = 100;
  Needs.fun[eid] = 100;

  // Sprite reference — use pixel art texture key
  const textureKey = `creature_${type}`;
  addComponent(world, eid, SpriteRef);
  SpriteRef.textureKey[eid] = hashTextureKey(textureKey);

  // AI state
  addComponent(world, eid, AIStateComponent);
  AIStateComponent.state[eid] = AIState.Idle as unknown as number;
  AIStateComponent.target[eid] = 0;
  AIStateComponent.job[eid] = 0;
  AIStateComponent.timer[eid] = 0;

  // Faction
  addComponent(world, eid, Faction);
  Faction.id[eid] = factionId;
  Faction.reputation[eid] = 50;

  // Pathfinder
  addComponent(world, eid, Pathfinder);
  Pathfinder.targetX[eid] = x;
  Pathfinder.targetY[eid] = y;
  Pathfinder.pathIndex[eid] = 0;
  Pathfinder.speed[eid] = config.speed;

  // Tag components
  addComponent(world, eid, Creature);
  addComponent(world, eid, Selectable);

  if (HUMANOID_TYPES.has(type)) {
    addComponent(world, eid, Humanoid);
  } else if (ANIMAL_TYPES.has(type)) {
    addComponent(world, eid, Animal);
  }

  // Fire spawn event
  eventBus.emit('entity:spawned', { entityId: eid, type });

  return eid;
}
