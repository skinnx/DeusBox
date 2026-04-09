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
import Combat from '../components/Combat.js';
import Reproduction from '../components/Reproduction.js';
import Inventory from '../components/Inventory.js';
import Equipment from '../components/Equipment.js';
import MilitaryRole from '../components/MilitaryRole.js';
import AnimationState from '../components/AnimationState.js';
import { Creature, Selectable, Humanoid, Animal } from '../components/TagComponents.js';
import { hashTextureKey } from '../systems/RenderSyncSystem.js';
import { eventBus } from '@/core/EventBus.js';
import { AIState } from '@/core/Types.js';

import creatureData from '@/data/creatures.json';

/** Track entity types for reproduction system lookups. */
export const entityTypes = new Map<number, string>();

/** Attack power per creature type (from task spec). */
const COMBAT_POWER: Record<string, number> = {
  human: 10,
  elf: 8,
  dwarf: 15,
  orc: 12,
  wolf: 8,
  bear: 15,
  deer: 3,
  chicken: 1,
  fish: 1,
};

/** Default attack range in pixels. */
const DEFAULT_ATTACK_RANGE = 48;
/** Default attack cooldown in milliseconds. */
const DEFAULT_ATTACK_COOLDOWN = 1000;
/** Maturity age in seconds: humanoids=100, animals=50. */
const HUMANOID_MATURITY_AGE = 100;
const ANIMAL_MATURITY_AGE = 50;
/** Default reproduction cooldown in seconds. */
const DEFAULT_REPRO_COOLDOWN = 0;

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
  militaryAptitude?: {
    role: string;
    aptitude: number;
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

  // Needs: hunger starts at 0 (full, increases when hungry)
  // rest/social/fun start at 100 (fully satisfied, decrease over time)
  addComponent(world, eid, Needs);
  Needs.hunger[eid] = 0;
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

  // Animation state (idle, facing down by default)
  addComponent(world, eid, AnimationState);
  AnimationState.state[eid] = 0;
  AnimationState.direction[eid] = 0;
  AnimationState.frameTimer[eid] = 0;
  AnimationState.frame[eid] = 0;
  AnimationState.deathProgress[eid] = 0;

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

    // MilitaryRole — assign based on creature config
    addComponent(world, eid, MilitaryRole);
    MilitaryRole.role[eid] = 0; // Default: no role (assigned later by MilitarySystem)
    MilitaryRole.rank[eid] = 0;
    MilitaryRole.formationX[eid] = 0;
    MilitaryRole.formationY[eid] = 0;
    MilitaryRole.combatTime[eid] = 0;
  } else if (ANIMAL_TYPES.has(type)) {
    addComponent(world, eid, Animal);
  }

  // ── Combat component ──────────────────────────────────────────────
  if (HUMANOID_TYPES.has(type) || ANIMAL_TYPES.has(type)) {
    addComponent(world, eid, Combat);
    Combat.attackPower[eid] = COMBAT_POWER[type] ?? 5;
    Combat.attackRange[eid] = DEFAULT_ATTACK_RANGE;
    Combat.attackCooldown[eid] = DEFAULT_ATTACK_COOLDOWN;
    Combat.lastAttackTime[eid] = 0;
    Combat.target[eid] = -1;
  }

  // ── Reproduction component (all creatures) ────────────────────────
  addComponent(world, eid, Reproduction);
  Reproduction.age[eid] = 0;
  Reproduction.maturityAge[eid] = HUMANOID_TYPES.has(type)
    ? HUMANOID_MATURITY_AGE
    : ANIMAL_MATURITY_AGE;
  Reproduction.cooldown[eid] = DEFAULT_REPRO_COOLDOWN;
  Reproduction.pregnant[eid] = 0;

  // ── Inventory component (humanoids only) ──────────────────────────
  if (HUMANOID_TYPES.has(type)) {
    addComponent(world, eid, Inventory);
    Inventory.wood[eid] = 0;
    Inventory.food[eid] = 0;
    Inventory.stone[eid] = 0;
    Inventory.gold[eid] = 0;
    Inventory.iron[eid] = 0;

    // Equipment component (default: no weapon, no armor, no accessory)
    addComponent(world, eid, Equipment);
  }

  // Track entity type for reproduction
  entityTypes.set(eid, type);

  // Fire spawn event
  eventBus.emit('entity:spawned', { entityId: eid, type });

  return eid;
}
