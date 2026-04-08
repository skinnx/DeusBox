import { query, hasComponent, addComponent, removeEntity } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import Faction from '../components/Faction.js';
import Combat from '../components/Combat.js';
import { Dead } from '../components/TagComponents.js';
import { destroyEntitySprite } from './RenderSyncSystem.js';
import { eventBus } from '@/core/EventBus.js';
import { spatialHash } from './SpatialIndexSystem.js';

/** Default attack range in pixels. */
const DEFAULT_ATTACK_RANGE = 48;
/** Distance at which combatants detect enemies. */
const AGGRO_RANGE = 200;
/** Default attack cooldown in milliseconds. */
const DEFAULT_ATTACK_COOLDOWN = 1000;

/**
 * Creates the combat system.
 * Entities with Combat component attack targets in range.
 * Damage applies to Health; dead entities get the Dead tag
 * and their sprites are cleaned up.
 */
export function createCombatSystem(
  sprites: Map<number, Phaser.GameObjects.Sprite>,
): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const combatants = query(world, [Position, Combat, Health, Faction]);
    const deadEntities: number[] = [];

    for (let i = 0; i < combatants.length; i++) {
      const eid = combatants[i];
      if (hasComponent(world, eid, Dead)) continue;

      const myFaction = Faction.id[eid];
      let targetEid = Combat.target[eid];

      // ── Validate current target ────────────────────────────────────
      let targetValid = false;
      if (targetEid >= 0) {
        // Check target still exists, is alive, and is enemy faction
        if (
          !hasComponent(world, targetEid, Dead) &&
          hasComponent(world, targetEid, Health) &&
          Faction.id[targetEid] !== myFaction
        ) {
          targetValid = true;
        }
      }

      // ── Find new target if needed ──────────────────────────────────
      if (!targetValid) {
        let nearestDist = AGGRO_RANGE * AGGRO_RANGE;
        let nearestEnemy = -1;

        // Use spatial hash for O(1) neighbor lookup instead of O(n²)
        const nearby = spatialHash.query(Position.x[eid], Position.y[eid], AGGRO_RANGE);

        for (let j = 0; j < nearby.length; j++) {
          const tEid = nearby[j];
          if (tEid === eid) continue;
          if (hasComponent(world, tEid, Dead)) continue;
          if (!hasComponent(world, tEid, Health)) continue;
          if (Faction.id[tEid] === myFaction) continue;

          const dx = Position.x[tEid] - Position.x[eid];
          const dy = Position.y[tEid] - Position.y[eid];
          const distSq = dx * dx + dy * dy;

          if (distSq < nearestDist) {
            nearestDist = distSq;
            nearestEnemy = tEid;
          }
        }

        targetEid = nearestEnemy;
        Combat.target[eid] = targetEid;
        // Reset attack timer when acquiring a new target
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

      // ── Attack cooldown ────────────────────────────────────────────
      const cooldown =
        Combat.attackCooldown[eid] > 0 ? Combat.attackCooldown[eid] : DEFAULT_ATTACK_COOLDOWN;

      Combat.lastAttackTime[eid] += delta;
      if (Combat.lastAttackTime[eid] < cooldown) continue;
      Combat.lastAttackTime[eid] = 0;

      // ── Deal damage ────────────────────────────────────────────────
      const damage = Combat.attackPower[eid];
      Health.current[targetEid] -= damage;

      // ── Handle death ───────────────────────────────────────────────
      if (Health.current[targetEid] <= 0) {
        Health.current[targetEid] = 0;
        addComponent(world, targetEid, Dead);
        eventBus.emit('entity:destroyed', { entityId: targetEid });

        // Invalidate target references to the dead entity
        for (let k = 0; k < combatants.length; k++) {
          if (Combat.target[combatants[k]] === targetEid) {
            Combat.target[combatants[k]] = -1;
          }
        }

        deadEntities.push(targetEid);
      }
    }

    // ── Cleanup dead entities ────────────────────────────────────────
    for (const eid of deadEntities) {
      destroyEntitySprite(world, sprites, eid);
      removeEntity(world, eid);
    }
  };
}
