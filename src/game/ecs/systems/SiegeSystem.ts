import { query, hasComponent, addComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import Faction from '../components/Faction.js';
import Combat from '../components/Combat.js';
import Structure from '../components/Structure.js';
import MilitaryRole from '../components/MilitaryRole.js';
import SiegeState from '../components/SiegeState.js';
import { Dead, Building } from '../components/TagComponents.js';
import { spatialHash } from './SpatialIndexSystem.js';
import { getEffectiveAttackPower, getMilitaryRole, ROLE_WARRIOR, ROLE_MAGE } from './MilitarySystem.js';
import { isAllied } from './DiplomacySystem.js';
import { destroyEntitySprite } from './RenderSyncSystem.js';
import { eventBus } from '@/core/EventBus.js';
import { TILE_SIZE } from '@/core/Constants.js';

/** Range at which military units can siege a building (px). */
const SIEGE_RANGE = TILE_SIZE * 4;
/** Minimum attackers to start a siege */
const MIN_SIEGE_ATTACKERS = 2;
/** Damage applied per second per attacker during siege */
const SIEGE_DPS_PER_ATTACKER = 5;
/** Warrior bonus siege damage multiplier */
const WARRIOR_SIEGE_BONUS = 1.5;
/** Mage AOE siege damage to nearby buildings */
const MAGE_AOE_SIEGE_RANGE = TILE_SIZE * 3;
/** Siege check throttle (ms) */
const SIEGE_THROTTLE = 2000;

/**
 * Creates the SiegeSystem.
 * Military units near enemy buildings initiate sieges, dealing damage over time.
 * Throttled to every 2s for performance.
 * Uses diplomacy system to check hostile factions.
 */
export function createSiegeSystem(
  sprites: Map<number, Phaser.GameObjects.Sprite>,
): (world: GameWorld, delta: number) => void {
  let throttleTimer = 0;

  return (world: GameWorld, delta: number): void => {
    throttleTimer += delta;
    if (throttleTimer < SIEGE_THROTTLE) return;
    throttleTimer = 0;

    const seconds = SIEGE_THROTTLE / 1000;
    const buildings = query(world, [Position, Structure, Health, Building]);

    // ── Process each building ──────────────────────────────────────────
    for (let b = 0; b < buildings.length; b++) {
      const buildEid = buildings[b]!;
      if (hasComponent(world, buildEid, Dead)) continue;

      const bx = Position.x[buildEid];
      const by = Position.y[buildEid];
      const buildFaction = Structure.factionId[buildEid];

      // Find hostile military units in siege range
      let attackerCount = 0;
      let primaryAttackerFaction = -1;
      let totalDPS = 0;

      const nearby = spatialHash.query(bx, by, SIEGE_RANGE);

      for (let m = 0; m < nearby.length; m++) {
        const unitEid = nearby[m]!;
        if (!hasComponent(world, unitEid, MilitaryRole)) continue;
        if (hasComponent(world, unitEid, Dead)) continue;

        const unitFaction = Faction.id[unitEid];

        // Must be different faction and not allied
        if (unitFaction === buildFaction) continue;
        if (isAllied(unitFaction, buildFaction)) continue;

        const dx = Position.x[unitEid] - bx;
        const dy = Position.y[unitEid] - by;
        if (dx * dx + dy * dy > SIEGE_RANGE * SIEGE_RANGE) continue;

        const role = getMilitaryRole(world, unitEid);
        if (role === 0) continue; // Skip non-military

        attackerCount++;
        if (primaryAttackerFaction < 0) {
          primaryAttackerFaction = unitFaction;
        }

        // Calculate siege DPS based on role
        let dps = SIEGE_DPS_PER_ATTACKER;
        if (role === ROLE_WARRIOR) {
          dps *= WARRIOR_SIEGE_BONUS;
        }
        const power = getEffectiveAttackPower(unitEid);
        dps *= power / 10;

        totalDPS += dps;
      }

      // ── Update siege state ───────────────────────────────────────────
      const wasSieged = hasComponent(world, buildEid, SiegeState) && SiegeState.active[buildEid] === 1;

      if (attackerCount >= MIN_SIEGE_ATTACKERS) {
        if (!hasComponent(world, buildEid, SiegeState)) {
          addComponent(world, buildEid, SiegeState);
        }
        SiegeState.active[buildEid] = 1;
        SiegeState.attackerCount[buildEid] = attackerCount;
        SiegeState.attackerFaction[buildEid] = primaryAttackerFaction;
        SiegeState.siegeDuration[buildEid] += SIEGE_THROTTLE;
        SiegeState.siegeDamage[buildEid] += totalDPS * seconds;

        // Emit siege:start when siege begins
        if (!wasSieged) {
          eventBus.emit('siege:start', {
            attackerFaction: primaryAttackerFaction,
            targetBuilding: buildEid,
          });
        }

        // Apply siege damage to building health
        Health.current[buildEid] -= totalDPS * seconds;

        // Mage AOE: mages in siege also damage nearby buildings of same faction
        for (let m = 0; m < nearby.length; m++) {
          const unitEid = nearby[m]!;
          if (!hasComponent(world, unitEid, MilitaryRole)) continue;
          if (hasComponent(world, unitEid, Dead)) continue;
          if (Faction.id[unitEid] === buildFaction) continue;
          if (isAllied(Faction.id[unitEid], buildFaction)) continue;

          const role = getMilitaryRole(world, unitEid);
          if (role !== ROLE_MAGE) continue;

          for (let b2 = 0; b2 < buildings.length; b2++) {
            const otherBuildEid = buildings[b2]!;
            if (otherBuildEid === buildEid) continue;
            if (hasComponent(world, otherBuildEid, Dead)) continue;
            if (Structure.factionId[otherBuildEid] !== buildFaction) continue;

            const dx2 = Position.x[otherBuildEid] - bx;
            const dy2 = Position.y[otherBuildEid] - by;
            if (dx2 * dx2 + dy2 * dy2 > MAGE_AOE_SIEGE_RANGE * MAGE_AOE_SIEGE_RANGE) continue;

            const magePower = getEffectiveAttackPower(unitEid);
            Health.current[otherBuildEid] -= (magePower * 0.3) * seconds;
          }
        }

        // ── Handle building destruction ────────────────────────────────
        if (Health.current[buildEid] <= 0) {
          Health.current[buildEid] = 0;
          addComponent(world, buildEid, Dead);

          eventBus.emit('siege:end', {
            buildingDestroyed: true,
            factionId: buildFaction,
          });

          eventBus.emit('building:destroyed', {
            entityId: buildEid,
            destroyedBy: primaryAttackerFaction,
            buildingType: Structure.type[buildEid],
            siegeDuration: SiegeState.siegeDuration[buildEid],
            factionId: buildFaction,
          });

          eventBus.emit('storyteller:event', {
            type: 'building_destroyed',
            data: {
              buildingEntityId: buildEid,
              destroyedBy: primaryAttackerFaction,
              x: bx,
              y: by,
            },
          });

          destroyEntitySprite(world, sprites, buildEid);
        }
      } else {
        // No siege — reset state if previously sieged
        if (wasSieged) {
          SiegeState.active[buildEid] = 0;
          SiegeState.attackerCount[buildEid] = 0;
          SiegeState.siegeDamage[buildEid] = 0;

          eventBus.emit('siege:end', {
            buildingDestroyed: false,
            factionId: buildFaction,
          });
        }
      }
    }
  };
}
