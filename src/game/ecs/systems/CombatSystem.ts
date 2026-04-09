import { query, hasComponent, addComponent, removeEntity } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import Faction from '../components/Faction.js';
import Combat from '../components/Combat.js';
import Structure from '../components/Structure.js';
import MilitaryRole from '../components/MilitaryRole.js';
import { Dead, Building } from '../components/TagComponents.js';
import { destroyEntitySprite } from './RenderSyncSystem.js';
import { getMilitaryRole, getEffectiveAttackPower, ROLE_MAGE, ROLE_ARCHER, ROLE_WARRIOR, getRoleModifiers } from './MilitarySystem.js';
import { eventBus } from '@/core/EventBus.js';
import { spatialHash } from './SpatialIndexSystem.js';
import { isAllied } from './DiplomacySystem.js';
import { isInOwnTerritory } from './TerritorySystem.js';

/** Default attack range in pixels. */
const DEFAULT_ATTACK_RANGE = 48;
/** Distance at which combatants detect enemies. */
const DEFAULT_AGGRO_RANGE = 200;
/** Default attack cooldown in milliseconds. */
const DEFAULT_ATTACK_COOLDOWN = 1000;
/** Mage AOE splash radius (px) */
const MAGE_AOE_RADIUS = 48;

/**
 * Creates the combat system.
 * Entities with Combat component attack targets in range.
 * Damage applies to Health; dead entities get the Dead tag
 * and their sprites are cleaned up.
 *
 * Military roles modify combat behavior:
 * - Warrior: higher aggro range (300), standard range
 * - Archer: long range (150), faster cooldown
 * - Mage: medium range (80), AOE damage, slower cooldown
 */
export function createCombatSystem(
  sprites: Map<number, Phaser.GameObjects.Sprite>,
): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const combatants = query(world, [Position, Combat, Health, Faction]);
    const deadEntities: number[] = [];

    for (let i = 0; i < combatants.length; i++) {
      const eid = combatants[i]!;
      if (hasComponent(world, eid, Dead)) continue;

      const myFaction = Faction.id[eid];
      let targetEid = Combat.target[eid];

      // ── Determine aggro range based on military role ─────────────────
      let aggroRange = DEFAULT_AGGRO_RANGE;
      const role = getMilitaryRole(world, eid);
      const roleMods = getRoleModifiers(role);
      if (roleMods) {
        aggroRange = roleMods.aggroRange;
      }

      // ── Validate current target ────────────────────────────────────
      let targetValid = false;
      if (targetEid >= 0) {
        if (
          !hasComponent(world, targetEid, Dead) &&
          hasComponent(world, targetEid, Health) &&
          Faction.id[targetEid] !== myFaction &&
          !isAllied(myFaction, Faction.id[targetEid])
        ) {
          targetValid = true;
        }
        // Also valid if target is an enemy building
        if (
          !hasComponent(world, targetEid, Dead) &&
          hasComponent(world, targetEid, Health) &&
          hasComponent(world, targetEid, Building) &&
          Structure.factionId[targetEid] !== myFaction &&
          !isAllied(myFaction, Structure.factionId[targetEid])
        ) {
          targetValid = true;
        }
      }

      // ── Find new target if needed ──────────────────────────────────
      if (!targetValid) {
        let nearestDist = aggroRange * aggroRange;
        let nearestEnemy = -1;
        let nearestBuilding = -1;
        let nearestBuildingDist = aggroRange * aggroRange;

        const nearby = spatialHash.query(Position.x[eid], Position.y[eid], aggroRange);

        for (let j = 0; j < nearby.length; j++) {
          const tEid = nearby[j]!;
          if (tEid === eid) continue;
          if (hasComponent(world, tEid, Dead)) continue;
          if (!hasComponent(world, tEid, Health)) continue;

          const dx = Position.x[tEid] - Position.x[eid];
          const dy = Position.y[tEid] - Position.y[eid];
          const distSq = dx * dx + dy * dy;

          // Check if this is an enemy creature
          if (
            hasComponent(world, tEid, Faction) &&
            Faction.id[tEid] !== myFaction &&
            !isAllied(myFaction, Faction.id[tEid])
          ) {
            if (distSq < nearestDist) {
              nearestDist = distSq;
              nearestEnemy = tEid;
            }
          }

          // Check if this is an enemy building (military only)
          if (
            role > 0 &&
            hasComponent(world, tEid, Building) &&
            hasComponent(world, tEid, Structure) &&
            Structure.factionId[tEid] !== myFaction &&
            !isAllied(myFaction, Structure.factionId[tEid])
          ) {
            if (distSq < nearestBuildingDist) {
              nearestBuildingDist = distSq;
              nearestBuilding = tEid;
            }
          }
        }

        // Prefer creature targets; fall back to buildings for military units
        targetEid = nearestEnemy >= 0 ? nearestEnemy : nearestBuilding;
        Combat.target[eid] = targetEid;
        Combat.lastAttackTime[eid] = 0;
      }

      if (targetEid < 0) continue;

      // ── Check attack range ─────────────────────────────────────────
      const dx = Position.x[targetEid] - Position.x[eid];
      const dy = Position.y[targetEid] - Position.y[eid];
      const distSq = dx * dx + dy * dy;
      const attackRange =
        Combat.attackRange[eid] > 0 ? Combat.attackRange[eid] : DEFAULT_ATTACK_RANGE;

      if (distSq > attackRange * attackRange) continue;

      // ── Attack cooldown (role-modified) ────────────────────────────
      let cooldown =
        Combat.attackCooldown[eid] > 0 ? Combat.attackCooldown[eid] : DEFAULT_ATTACK_COOLDOWN;
      if (roleMods) {
        cooldown *= roleMods.cooldownMul;
      }

      Combat.lastAttackTime[eid] += delta;
      if (Combat.lastAttackTime[eid] < cooldown) continue;
      Combat.lastAttackTime[eid] = 0;

      // ── Deal damage (role-modified) ────────────────────────────────
      const damage = roleMods ? getEffectiveAttackPower(eid) : Combat.attackPower[eid];
      const isBuildingTarget = hasComponent(world, targetEid, Building);

      // Territory defense bonus: -20% damage if target is in own territory
      const targetFaction = isBuildingTarget
        ? Structure.factionId[targetEid]
        : Faction.id[targetEid];
      const territoryDefense = isInOwnTerritory(
        targetFaction, Position.x[targetEid], Position.y[targetEid],
      );

      // Mage: AOE damage to all enemies within splash radius of target
      if (role === ROLE_MAGE) {
        const targetX = Position.x[targetEid];
        const targetY = Position.y[targetEid];
        const splashNearby = spatialHash.query(targetX, targetY, MAGE_AOE_RADIUS);

        for (let s = 0; s < splashNearby.length; s++) {
          const splashEid = splashNearby[s]!;
          if (splashEid === eid) continue;
          if (hasComponent(world, splashEid, Dead)) continue;
          if (!hasComponent(world, splashEid, Health)) continue;
          if (Faction.id[splashEid] === myFaction) continue;

          const sdx = Position.x[splashEid] - targetX;
          const sdy = Position.y[splashEid] - targetY;
          if (sdx * sdx + sdy * sdy <= MAGE_AOE_RADIUS * MAGE_AOE_RADIUS) {
            const splashDefend = isInOwnTerritory(
              Faction.id[splashEid], Position.x[splashEid], Position.y[splashEid],
            );
            const splashDmg = damage * (splashDefend ? 0.8 : 1.0);
            Health.current[splashEid] -= splashDmg;
            if (Health.current[splashEid] <= 0) {
              Health.current[splashEid] = 0;
              addComponent(world, splashEid, Dead);
              eventBus.emit('entity:destroyed', { entityId: splashEid });
              deadEntities.push(splashEid);
            }
          }
        }
      } else {
        // Single-target damage for warrior / archer / none
        const finalDmg = damage * (territoryDefense ? 0.8 : 1.0);
        Health.current[targetEid] -= finalDmg;
      }

      // ── Handle death of primary target ─────────────────────────────
      if (Health.current[targetEid] <= 0) {
        Health.current[targetEid] = 0;
        addComponent(world, targetEid, Dead);
        eventBus.emit('entity:destroyed', { entityId: targetEid });

        for (let k = 0; k < combatants.length; k++) {
          if (Combat.target[combatants[k]!] === targetEid) {
            Combat.target[combatants[k]!] = -1;
          }
        }

        deadEntities.push(targetEid);
      }
    }

    // ── Cleanup dead entities ────────────────────────────────────────
    for (const deadEid of deadEntities) {
      destroyEntitySprite(world, sprites, deadEid);
      removeEntity(world, deadEid);
    }
  };
}
