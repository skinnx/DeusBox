import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Inventory from '../components/Inventory.js';
import Equipment from '../components/Equipment.js';
import Combat from '../components/Combat.js';
import Health from '../components/Health.js';
import Structure from '../components/Structure.js';
import Faction from '../components/Faction.js';
import { Humanoid } from '../components/TagComponents.js';
import { TILE_SIZE } from '@/core/Constants.js';
import recipesData from '@/data/recipes.json';
import buildingsData from '@/data/buildings.json';
import { canEquip } from './TechSystem.js';

interface RecipeInputs {
  iron?: number;
  wood?: number;
  crystal?: number;
  herbs?: number;
  gold?: number;
  stone?: number;
  food?: number;
}

interface Recipe {
  inputs: RecipeInputs;
  outputType: 'weapon' | 'armor';
  outputId: number;
  craftTime: number;
}

type Recipes = Record<string, Recipe>;

const recipes = recipesData as unknown as Recipes;

/** Building type name list (same order as Structure.type index) */
const BUILDING_TYPE_LIST = Object.keys(buildingsData);

/** Building "provides" values that enable crafting */
const CRAFT_BUILDINGS = new Set(['storage', 'military']);

/** Weapon bonus: attackPower added to Combat.attackPower */
const WEAPON_BONUS: Record<number, { attackPower: number; range: number }> = {
  0: { attackPower: 0, range: 0 },
  1: { attackPower: 5, range: 0 },   // Sword
  2: { attackPower: 3, range: 50 },   // Bow
  3: { attackPower: 4, range: 0 },    // Staff (AOE bonus handled in CombatSystem)
};

/** Armor bonus: maxHealth added to Health.max */
const ARMOR_BONUS: Record<number, number> = {
  0: 0,    // None
  1: 20,   // Leather
  2: 40,   // Chain
  3: 60,   // Plate
};

/** Crafting check interval in milliseconds */
const CRAFT_CHECK_INTERVAL = 10000;

/** Distance from building to craft (pixels) */
const CRAFT_RANGE = TILE_SIZE * 3;

let elapsedSinceLastCheck = 0;

/**
 * Maps recipe input keys to Inventory field names.
 */
const INPUT_TO_FIELD: Record<string, keyof typeof Inventory> = {
  iron: 'iron',
  wood: 'wood',
  crystal: 'crystal',
  herbs: 'herbs',
  gold: 'gold',
  stone: 'stone',
  food: 'food',
};

/**
 * Creates the crafting system.
 * Humanoid entities near warehouse or barracks auto-craft equipment
 * if they have sufficient resources in their Inventory.
 */
export function createCraftingSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    elapsedSinceLastCheck += delta;
    if (elapsedSinceLastCheck < CRAFT_CHECK_INTERVAL) return;
    elapsedSinceLastCheck = 0;

    const crafters = query(world, [Position, Inventory, Equipment, Humanoid]);
    const buildings = query(world, [Position, Structure]);

    // Build list of crafting-enabled buildings with positions
    const craftStations: Array<{ x: number; y: number }> = [];
    for (let b = 0; b < buildings.length; b++) {
      const bid = buildings[b]!;
      const typeIndex = Math.floor(Structure.type[bid]);
      const buildingName = BUILDING_TYPE_LIST[typeIndex];
      if (!buildingName) continue;
      const config = (buildingsData as Record<string, { provides: string }>)[buildingName];
      if (!config || !CRAFT_BUILDINGS.has(config.provides)) continue;
      craftStations.push({ x: Position.x[bid], y: Position.y[bid] });
    }

    if (craftStations.length === 0) return;

    for (let c = 0; c < crafters.length; c++) {
      const eid = crafters[c]!;
      const cx = Position.x[eid];
      const cy = Position.y[eid];

      // Check if near a crafting building
      let nearStation = false;
      for (const station of craftStations) {
        const dx = cx - station.x;
        const dy = cy - station.y;
        if (dx * dx + dy * dy < CRAFT_RANGE * CRAFT_RANGE) {
          nearStation = true;
          break;
        }
      }
      if (!nearStation) continue;

      // Try each recipe
      for (const [_recipeName, recipe] of Object.entries(recipes)) {
        const currentWeapon = Equipment.weapon[eid];
        const currentArmor = Equipment.armor[eid];

        // Only craft if the result would be an upgrade
        if (recipe.outputType === 'weapon' && recipe.outputId <= currentWeapon) continue;
        if (recipe.outputType === 'armor' && recipe.outputId <= currentArmor) continue;

        // Tech check: equipment requires tech unlock
        const factionId = hasComponent(world, eid, Faction) ? Math.floor(Faction.id[eid]) : -1;
        const equipId = recipe.outputType === 'weapon'
          ? `weapon_${recipe.outputId}`
          : `armor_${recipe.outputId}`;
        if (factionId >= 0 && !canEquip(factionId, equipId)) continue;

        // Check if entity has enough resources
        let canCraft = true;
        for (const [resource, amount] of Object.entries(recipe.inputs)) {
          const field = INPUT_TO_FIELD[resource];
          if (!field || Inventory[field][eid] < amount) {
            canCraft = false;
            break;
          }
        }
        if (!canCraft) continue;

        // Deduct resources
        for (const [resource, amount] of Object.entries(recipe.inputs)) {
          const field = INPUT_TO_FIELD[resource];
          if (field) {
            Inventory[field][eid] -= amount;
          }
        }

        // Apply equipment
        if (recipe.outputType === 'weapon') {
          Equipment.weapon[eid] = recipe.outputId;
          // Apply weapon combat bonus
          const bonus = WEAPON_BONUS[recipe.outputId];
          if (bonus && hasComponent(world, eid, Combat)) {
            Combat.attackPower[eid] += bonus.attackPower;
            Combat.attackRange[eid] += bonus.range;
          }
        } else if (recipe.outputType === 'armor') {
          Equipment.armor[eid] = recipe.outputId;
          // Apply armor health bonus
          const bonus = ARMOR_BONUS[recipe.outputId] ?? 0;
          if (hasComponent(world, eid, Health)) {
            Health.max[eid] += bonus;
          }
        }
      }
    }
  };
}

export { WEAPON_BONUS, ARMOR_BONUS };
