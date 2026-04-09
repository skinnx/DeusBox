import { query, hasComponent, addComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Inventory from '../components/Inventory.js';
import Structure from '../components/Structure.js';
import Faction from '../components/Faction.js';
import Needs from '../components/Needs.js';
import Combat from '../components/Combat.js';
import Health from '../components/Health.js';
import { Humanoid, Dead, Building } from '../components/TagComponents.js';
import { entityTypes } from '../factories/CreatureFactory.js';
import { destroyEntitySprite } from './RenderSyncSystem.js';
import { eventBus } from '@/core/EventBus.js';
import { TILE_SIZE } from '@/core/Constants.js';
import { spawnBuilding, getBuildingHP } from '../factories/BuildingFactory.js';
import type { TileMap } from '@/world/TileMap.js';
import { canBuild, hasTechModifier } from './TechSystem.js';

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

type InventoryField = 'wood' | 'food' | 'stone' | 'gold' | 'iron';
const VALID_INVENTORY_FIELDS = new Set<string>(['wood', 'food', 'stone', 'gold', 'iron']);

function isInventoryField(key: string): key is InventoryField {
  return VALID_INVENTORY_FIELDS.has(key);
}

/** Building type name to index mapping. */
const BUILDING_TYPE_LIST = Object.keys(buildingData);

/** Attack power per creature type for capping barracks bonus. */
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

/** Build attempt interval in milliseconds. */
const BUILD_INTERVAL = 15000;
/** Range for building bonuses. */
const BONUS_RANGE = TILE_SIZE * 5;

/**
 * Creates the building system that handles construction and building bonuses.
 * Creatures with enough resources construct buildings. Buildings provide
 * passive bonuses to nearby faction creatures.
 */
export function createBuildingSystem(tileMap: TileMap): (world: GameWorld, delta: number) => void {
  let buildTimer = 0;

  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;

    // ── Apply building bonuses ──────────────────────────────────────────
    applyBuildingBonuses(world, seconds);

    // ── Check for destroyed buildings ───────────────────────────────────
    checkBuildingDestruction(world);

    // ── Construction (throttled) ────────────────────────────────────────
    buildTimer += delta;
    if (buildTimer < BUILD_INTERVAL) return;
    buildTimer = 0;

    attemptConstruction(world, tileMap);
  };
}

/**
 * Check buildings with 0 HP, mark as Dead and emit event.
 * Note: sprite cleanup is handled by RenderSyncSystem or SiegeSystem.
 */
function checkBuildingDestruction(world: GameWorld): void {
  const buildings = query(world, [Structure, Health, Building]);

  for (let i = 0; i < buildings.length; i++) {
    const eid = buildings[i]!;
    if (hasComponent(world, eid, Dead)) continue;
    if (Health.current[eid] > 0) continue;

    Health.current[eid] = 0;
    addComponent(world, eid, Dead);

    eventBus.emit('building:destroyed', {
      entityId: eid,
      buildingType: Structure.type[eid],
      factionId: Structure.factionId[eid],
    });
  }
}

/**
 * Applies passive bonuses from buildings to nearby faction creatures.
 * - House: reduces rest need decay (increases rest)
 * - Farm: no active bonus (ResourceSource handles food production)
 * - Warehouse: passive storage (no active effect)
 * - Barracks: increases attack power for nearby faction members
 */
function applyBuildingBonuses(world: GameWorld, seconds: number): void {
  const buildings = query(world, [Position, Structure, Faction]);
  const creatures = query(world, [Position, Faction, Needs]);

  for (let b = 0; b < buildings.length; b++) {
    const buildEid = buildings[b];
    const buildingTypeIndex = Math.floor(Structure.type[buildEid]);
    const buildingType = BUILDING_TYPE_LIST[buildingTypeIndex];
    if (!buildingType) continue;

    const bx = Position.x[buildEid];
    const by = Position.y[buildEid];
    const bFaction = Structure.factionId[buildEid];

    for (let c = 0; c < creatures.length; c++) {
      const creatureEid = creatures[c];
      if (hasComponent(world, creatureEid, Dead)) continue;
      if (Faction.id[creatureEid] !== bFaction) continue;

      const dx = Position.x[creatureEid] - bx;
      const dy = Position.y[creatureEid] - by;
      const distSq = dx * dx + dy * dy;

      if (distSq < BONUS_RANGE * BONUS_RANGE) {
        const buildingFaction = Math.floor(Faction.id[buildEid]);

        switch (buildingType) {
          case 'farm':
            // Farm: food production bonus with Agriculture tech
            if (hasTechModifier(buildingFaction, 'farmProduction')) {
              Needs.fun[creatureEid] = Math.min(100, Needs.fun[creatureEid] + 0.3 * seconds);
            }
            break;

          case 'house':
            // Houses reduce rest need decay — increase rest
            Needs.rest[creatureEid] = Math.min(100, Needs.rest[creatureEid] + 0.5 * seconds);
            break;

          case 'barracks':
            // Barracks boost attack power for faction members (capped at 2x base power)
            if (hasComponent(world, creatureEid, Combat)) {
              const creatureType = entityTypes.get(creatureEid);
              const basePower = creatureType ? (COMBAT_POWER[creatureType] ?? 5) : 5;
              const maxPower = basePower * 2;
              Combat.attackPower[creatureEid] = Math.min(
                maxPower,
                Combat.attackPower[creatureEid] + 0.1 * seconds,
              );
            }
            break;

          case 'temple':
            // Temples boost social need
            Needs.social[creatureEid] = Math.min(100, Needs.social[creatureEid] + 0.3 * seconds);
            break;
        }
      }
    }
  }
}

/**
 * Attempts to construct a building if any humanoid has sufficient resources.
 * Picks the most affordable building and deducts resources.
 */
function attemptConstruction(world: GameWorld, _tileMap: TileMap): void {
  const configs = buildingData as Record<string, BuildingConfig>;
  const humanoids = query(world, [Position, Inventory, Faction]);

  for (let h = 0; h < humanoids.length; h++) {
    const eid = humanoids[h];
    if (!hasComponent(world, eid, Humanoid)) continue;
    if (hasComponent(world, eid, Dead)) continue;

    // Try to find an affordable building
    const factionId = Math.floor(Faction.id[eid]);
    for (const [buildingType, config] of Object.entries(configs)) {
      if (!canBuild(factionId, buildingType)) continue;
      if (canAfford(Inventory, eid, config.cost)) {
        // Deduct resources
        deductResources(Inventory, eid, config.cost);

        // Spawn building at creature's position
        const buildEid = spawnBuilding(
          world,
          buildingType,
          Position.x[eid],
          Position.y[eid],
          Faction.id[eid],
        );

        if (buildEid >= 0) {
          // Add Structure component
          addComponent(world, buildEid, Structure);
          Structure.type[buildEid] = BUILDING_TYPE_LIST.indexOf(buildingType);
          Structure.factionId[buildEid] = Faction.id[eid];
          Structure.level[buildEid] = 1;
          Structure.health[buildEid] = Health.current[buildEid];
          Structure.maxHealth[buildEid] = Health.max[buildEid];
        }

        // Only one building per interval per humanoid
        break;
      }
    }
  }
}

/**
 * Checks if an entity can afford the given resource cost.
 */
function canAfford(
  inventory: typeof Inventory,
  eid: number,
  cost: Record<string, number>,
): boolean {
  for (const [resource, amount] of Object.entries(cost)) {
    if (!isInventoryField(resource)) continue;
    if (inventory[resource][eid] < amount) return false;
  }
  return true;
}

/**
 * Deducts resources from an entity's inventory.
 */
function deductResources(
  inventory: typeof Inventory,
  eid: number,
  cost: Record<string, number>,
): void {
  for (const [resource, amount] of Object.entries(cost)) {
    if (!isInventoryField(resource)) continue;
    inventory[resource][eid] -= amount;
  }
}
