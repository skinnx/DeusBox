import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Faction from '../components/Faction.js';
import Combat from '../components/Combat.js';
import MilitaryRole from '../components/MilitaryRole.js';
import SiegeState from '../components/SiegeState.js';
import Structure from '../components/Structure.js';
import Pathfinder from '../components/Pathfinder.js';
import AIStateComponent from '../components/AIState.js';
import SpriteRef from '../components/SpriteRef.js';
import { Humanoid, Building, Dead } from '../components/TagComponents.js';
import { spatialHash } from './SpatialIndexSystem.js';
import { hashTextureKey } from './RenderSyncSystem.js';
import { entityTypes } from '../factories/CreatureFactory.js';
import { TILE_SIZE } from '@/core/Constants.js';
import { AIState } from '@/core/Types.js';
import creatureData from '@/data/creatures.json';

/** Role enum values matching MilitaryRole.role field */
export const ROLE_NONE = 0;
export const ROLE_WARRIOR = 1;
export const ROLE_ARCHER = 2;
export const ROLE_MAGE = 3;

/** Role name to numeric mapping */
const ROLE_MAP: Record<string, number> = {
  warrior: ROLE_WARRIOR,
  archer: ROLE_ARCHER,
  mage: ROLE_MAGE,
};

/** Role-specific combat modifiers */
const ROLE_MODIFIERS: Record<number, {
  attackPowerMul: number;
  attackRange: number;
  aggroRange: number;
  cooldownMul: number;
}> = {
  [ROLE_WARRIOR]: { attackPowerMul: 1.5, attackRange: 48, aggroRange: 300, cooldownMul: 1.0 },
  [ROLE_ARCHER]: { attackPowerMul: 0.8, attackRange: 150, aggroRange: 200, cooldownMul: 0.7 },
  [ROLE_MAGE]: { attackPowerMul: 0.6, attackRange: 80, aggroRange: 150, cooldownMul: 1.3 },
};

/** Proximity to barracks (in tiles) for role assignment */
const BARRACKS_PROXIMITY_TILES = 5;
/** Time near barracks before role assignment (ms) */
const BARRACKS_ASSIGN_TIME = 5000;
/** Formation detection radius (px) */
const FORMATION_RADIUS = 200;
/** Minimum military entities for formation */
const FORMATION_MIN = 3;
/** Time in combat (ms) per rank increase */
const RANK_COMBAT_TIME = 60000;
/** Maximum rank */
const MAX_RANK = 3;
/** Rank attack power bonus per rank (10%) */
const RANK_POWER_BONUS = 0.1;
/** Range at which military units respond to building attacks (px) */
const DEFEND_RANGE = 400;

/** Track time humanoid has been near a barracks */
const barracksProximityTime = new Float32Array(10000);

/**
 * Helper: get the numeric military role for an entity.
 * Returns ROLE_NONE (0) if entity has no MilitaryRole component.
 */
export function getMilitaryRole(world: GameWorld, eid: number): number {
  if (!hasComponent(world, eid, MilitaryRole)) return ROLE_NONE;
  return MilitaryRole.role[eid] ?? ROLE_NONE;
}

/**
 * Helper: get role modifiers for an entity. Returns null if no role.
 */
export function getRoleModifiers(role: number): typeof ROLE_MODIFIERS[number] | null {
  return ROLE_MODIFIERS[role] ?? null;
}

/**
 * Helper: get effective attack power including rank bonus.
 */
export function getEffectiveAttackPower(eid: number): number {
  const basePower = Combat.attackPower[eid];
  const role = MilitaryRole.role[eid];
  const modifiers = ROLE_MODIFIERS[role];
  if (!modifiers) return basePower;

  const rank = MilitaryRole.rank[eid];
  const rankBonus = 1 + rank * RANK_POWER_BONUS;
  return basePower * modifiers.attackPowerMul * rankBonus;
}

interface CreatureConfig {
  militaryAptitude?: {
    role: string;
    aptitude: number;
  };
}

/** Hash for "building_barracks" texture key — lazily initialized */
let barracksTextureHash = -1;
let barracksHashInitialized = false;

/**
 * Creates the MilitarySystem.
 * Handles role assignment, role modifiers, formation, and rank progression.
 */
export function createMilitarySystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    if (!barracksHashInitialized) {
      barracksTextureHash = hashTextureKey('building_barracks');
      barracksHashInitialized = true;
    }

    const humanoids = query(world, [Position, Combat, Faction, Humanoid]);

    for (let i = 0; i < humanoids.length; i++) {
      const eid = humanoids[i];
      if (!hasComponent(world, eid, MilitaryRole)) continue;

      const role = MilitaryRole.role[eid];

      // ── Role assignment: near barracks for > 5s ─────────────────────
      if (role === ROLE_NONE) {
        const nearby = spatialHash.query(
          Position.x[eid],
          Position.y[eid],
          TILE_SIZE * BARRACKS_PROXIMITY_TILES,
        );

        let nearBarracks = false;
        for (let j = 0; j < nearby.length; j++) {
          const structEid = nearby[j]!;
          if (structEid === eid) continue;
          // Check if this entity has a SpriteRef matching barracks
          if (hasComponent(world, structEid, SpriteRef)) {
            if (SpriteRef.textureKey[structEid] === barracksTextureHash) {
              nearBarracks = true;
              break;
            }
          }
        }

        if (nearBarracks) {
          barracksProximityTime[eid] += delta;
          if (barracksProximityTime[eid] >= BARRACKS_ASSIGN_TIME) {
            // Assign role based on creature config
            const creatureType = entityTypes.get(eid);
            if (creatureType) {
              const config = (creatureData as Record<string, CreatureConfig>)[creatureType];
              if (config?.militaryAptitude) {
                const assignedRole = ROLE_MAP[config.militaryAptitude.role] ?? ROLE_WARRIOR;
                MilitaryRole.role[eid] = assignedRole;
              }
            }
            barracksProximityTime[eid] = 0;
          }
        } else {
          barracksProximityTime[eid] = 0;
        }
        continue; // No modifiers until role assigned
      }

      // ── Apply role modifiers to Combat component ────────────────────
      const modifiers = ROLE_MODIFIERS[role];
      if (modifiers) {
        Combat.attackRange[eid] = modifiers.attackRange;
      }

      // ── Rank progression ─────────────────────────────────────────────
      if (Combat.target[eid] >= 0) {
        MilitaryRole.combatTime[eid] += delta;
        if (
          MilitaryRole.combatTime[eid] >= RANK_COMBAT_TIME &&
          MilitaryRole.rank[eid] < MAX_RANK
        ) {
          MilitaryRole.rank[eid] += 1;
          MilitaryRole.combatTime[eid] = 0;
        }
      }
    }

    // ── Formation logic ────────────────────────────────────────────────
    const factionGroups = new Map<number, number[]>();

    for (let i = 0; i < humanoids.length; i++) {
      const eid = humanoids[i];
      if (!hasComponent(world, eid, MilitaryRole)) continue;
      const r = MilitaryRole.role[eid];
      if (r === ROLE_NONE) continue;

      const factionId = Faction.id[eid];
      let group = factionGroups.get(factionId);
      if (!group) {
        group = [];
        factionGroups.set(factionId, group);
      }
      group.push(eid);
    }

    for (const [, group] of factionGroups) {
      if (group.length < FORMATION_MIN) continue;

      const anchorEid = group[0]!;
      const ax = Position.x[anchorEid];
      const ay = Position.y[anchorEid];

      const inRange: number[] = [];
      for (let i = 0; i < group.length; i++) {
        const eid = group[i]!;
        const dx = Position.x[eid] - ax;
        const dy = Position.y[eid] - ay;
        if (dx * dx + dy * dy < FORMATION_RADIUS * FORMATION_RADIUS) {
          inRange.push(eid);
        }
      }

      if (inRange.length < FORMATION_MIN) continue;

      // Sort: warriors (1) first, archers (2), mages (3) last
      inRange.sort((a, b) => MilitaryRole.role[a] - MilitaryRole.role[b]);

      const cols = Math.ceil(Math.sqrt(inRange.length));
      const spacing = TILE_SIZE;

      for (let i = 0; i < inRange.length; i++) {
        const eid = inRange[i]!;
        const row = Math.floor(i / cols);
        const col = i % cols;
        MilitaryRole.formationX[eid] = col * spacing - (cols * spacing) / 2;
        MilitaryRole.formationY[eid] = row * spacing;
      }
    }

    // ── Defend mode: respond to building attacks ────────────────────────
    // Find buildings under siege
    const buildings = query(world, [Position, Structure, Building]);
    const siegedBuildings: number[] = [];

    for (let b = 0; b < buildings.length; b++) {
      const buildEid = buildings[b]!;
      if (hasComponent(world, buildEid, Dead)) continue;
      if (!hasComponent(world, buildEid, SiegeState)) continue;
      if (SiegeState.active[buildEid] !== 1) continue;
      siegedBuildings.push(buildEid);
    }

    if (siegedBuildings.length > 0) {
      // Military entities defend buildings of same faction within DEFEND_RANGE
      for (let i = 0; i < humanoids.length; i++) {
        const eid = humanoids[i]!;
        if (hasComponent(world, eid, Dead)) continue;
        if (!hasComponent(world, eid, MilitaryRole)) continue;

        const role = MilitaryRole.role[eid];
        if (role === ROLE_NONE) continue;

        const myFaction = Faction.id[eid];
        // Skip if already fighting
        if (Combat.target[eid] >= 0) continue;

        // Find nearest sieged building of same faction
        let nearestBuildEid = -1;
        let nearestBuildDist = DEFEND_RANGE * DEFEND_RANGE;

        for (let s = 0; s < siegedBuildings.length; s++) {
          const buildEid = siegedBuildings[s]!;
          if (Structure.factionId[buildEid] !== myFaction) continue;

          const dx = Position.x[buildEid] - Position.x[eid];
          const dy = Position.y[buildEid] - Position.y[eid];
          const distSq = dx * dx + dy * dy;

          if (distSq < nearestBuildDist) {
            nearestBuildDist = distSq;
            nearestBuildEid = buildEid;
          }
        }

        if (nearestBuildEid < 0) continue;

        const bx = Position.x[nearestBuildEid];
        const by = Position.y[nearestBuildEid];

        // Role-based defend behavior
        let targetX: number;
        let targetY: number;

        if (role === ROLE_WARRIOR) {
          // Warriors rush to the building directly
          targetX = bx;
          targetY = by;
        } else if (role === ROLE_ARCHER) {
          // Archers position behind (offset from building toward attackers)
          const attackerFaction = SiegeState.attackerFaction[nearestBuildEid];
          // Move to building but keep distance
          targetX = bx - 60;
          targetY = by - 60;
        } else if (role === ROLE_MAGE) {
          // Mages stay further back for AOE coverage
          targetX = bx - 80;
          targetY = by - 80;
        } else {
          targetX = bx;
          targetY = by;
        }

        // Set pathfinder target
        if (hasComponent(world, eid, Pathfinder)) {
          Pathfinder.targetX[eid] = targetX;
          Pathfinder.targetY[eid] = targetY;
        }

        // Set AI state to Fighting
        AIStateComponent.state[eid] = AIState.Fighting as unknown as number;

        // Warriors: target the attacker directly if visible
        if (role === ROLE_WARRIOR) {
          const nearbyEnemies = spatialHash.query(bx, by, TILE_SIZE * 4);
          for (let e = 0; e < nearbyEnemies.length; e++) {
            const enemyEid = nearbyEnemies[e]!;
            if (hasComponent(world, enemyEid, Dead)) continue;
            if (!hasComponent(world, enemyEid, Faction)) continue;
            if (Faction.id[enemyEid] === myFaction) continue;

            const edx = Position.x[enemyEid] - Position.x[eid];
            const edy = Position.y[enemyEid] - Position.y[eid];
            if (edx * edx + edy * edy < (TILE_SIZE * 5) * (TILE_SIZE * 5)) {
              Combat.target[eid] = enemyEid;
              break;
            }
          }
        }
      }
    }
  };
}
