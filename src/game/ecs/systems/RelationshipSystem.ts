import { query, hasComponent, addComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Faction from '../components/Faction.js';
import Combat from '../components/Combat.js';
import Inventory from '../components/Inventory.js';
import Relationship, { MAX_RELATIONSHIPS } from '../components/Relationship.js';
import { Creature, Dead } from '../components/TagComponents.js';
import { eventBus } from '@/core/EventBus.js';

// ── Constants ──────────────────────────────────────────────────────────────

/** Proximity range (px) within which relationships develop. */
const RELATIONSHIP_RANGE = 150;
/** Sentiment gain per second when same-faction entities are nearby. */
const ALLY_SENTIMENT_BOOST = 2.0;
/** Sentiment loss per second when different-faction entities are nearby. */
const ENEMY_SENTIMENT_PENALTY = 1.5;
/** Sentiment loss per second while actively in combat with the target. */
const COMBAT_SENTIMENT_PENALTY = 10.0;
/** Relationship value above which entities are considered friends. */
const FRIEND_THRESHOLD = 60;
/** Relationship value below which entities are considered enemies. */
const ENEMY_THRESHOLD = -60;
/** Range within which friends share resources. */
const RESOURCE_SHARE_RANGE = 100;
/** Food transfer rate per second between nearby friends. */
const RESOURCE_SHARE_RATE = 0.1;
/** Extended aggro range for entities that have enemy relationships. */
const ENEMY_AGGRO_EXTENSION = 300;

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_LABELS = ['neutral', 'friend', 'enemy', 'romance', 'family'] as const;

function typeLabel(idx: number): string {
  return idx >= 0 && idx < TYPE_LABELS.length ? TYPE_LABELS[idx] : 'neutral';
}

/**
 * Find the slot index for an existing relationship with `targetEid`,
 * or `-1` if none exists.
 */
function findSlot(eid: number, targetEid: number): number {
  const base = eid * MAX_RELATIONSHIPS;
  const count = Relationship.count[eid];
  for (let s = 0; s < count; s++) {
    if (Relationship.target[base + s] === targetEid) return s;
  }
  return -1;
}

/**
 * Find the next free slot for entity `eid`, or `-1` if at capacity.
 */
function freeSlot(eid: number): number {
  const count = Relationship.count[eid];
  return count < MAX_RELATIONSHIPS ? count : -1;
}

/**
 * Ensure `eid` has a relationship entry for `targetEid`, then apply
 * `delta` to its value. Creates the Relationship component and slot
 * when necessary. Emits `relationship:changed` when the type changes.
 */
function applySentiment(world: GameWorld, eid: number, targetEid: number, delta: number): void {
  if (eid === targetEid) return;

  if (!hasComponent(world, eid, Relationship)) {
    addComponent(world, eid, Relationship);
  }

  let slot = findSlot(eid, targetEid);
  if (slot < 0) {
    slot = freeSlot(eid);
    if (slot < 0) return; // at capacity
    const base = eid * MAX_RELATIONSHIPS;
    Relationship.target[base + slot] = targetEid;
    Relationship.value[base + slot] = 0;
    Relationship.type[base + slot] = 0;
    Relationship.count[eid]++;
  }

  const base = eid * MAX_RELATIONSHIPS;
  const prev = Relationship.value[base + slot];
  const next = Math.max(-100, Math.min(100, prev + delta));
  Relationship.value[base + slot] = next;

  // ── Determine type from thresholds ──────────────────────────────────
  const oldType = Relationship.type[base + slot];
  let newType: number;
  if (next > FRIEND_THRESHOLD) {
    newType = 1; // friend
  } else if (next < ENEMY_THRESHOLD) {
    newType = 2; // enemy
  } else {
    // Revert to neutral only if it was friend or enemy
    newType = oldType === 1 || oldType === 2 ? 0 : oldType;
  }

  if (newType !== oldType) {
    Relationship.type[base + slot] = newType;
    eventBus.emit('relationship:changed', {
      entityId: eid,
      targetId: targetEid,
      value: next,
      type: typeLabel(newType),
    });
  }
}

// ── System factory ─────────────────────────────────────────────────────────

function compactRelationships(world: GameWorld): void {
  const relEnts = query(world, [Relationship]);
  for (const eid of relEnts) {
    const base = eid * MAX_RELATIONSHIPS;
    let writeIdx = 0;
    const count = Relationship.count[eid];
    for (let s = 0; s < count; s++) {
      const targetEid = Relationship.target[base + s];
      if (targetEid >= 0 && hasComponent(world, targetEid, Position)) {
        if (writeIdx !== s) {
          Relationship.target[base + writeIdx] = Relationship.target[base + s];
          Relationship.value[base + writeIdx] = Relationship.value[base + s];
          Relationship.type[base + writeIdx] = Relationship.type[base + s];
        }
        writeIdx++;
      }
    }
    Relationship.count[eid] = writeIdx;
  }
}

/**
 * Creates the Relationship system.
 *
 * Processes entities with Position + Faction + Creature:
 * - Same-faction proximity → positive sentiment
 * - Different-faction proximity → negative sentiment
 * - Active combat (Combat.target) → negative sentiment
 * - Friends share resources (Inventory food transfer)
 * - Enemies get extended aggro range (Combat.target set early)
 */
export function createRelationshipSystem(): (world: GameWorld, delta: number) => void {
  let proximityCounter = 0;
  let compactCounter = 0;

  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const ents = query(world, [Position, Faction, Creature]);

    // ── 1. Proximity-based relationship building (throttled) ────────────
    proximityCounter++;
    if (proximityCounter % 10 === 0) {
      for (let i = 0; i < ents.length; i++) {
        const eid = ents[i];
        if (hasComponent(world, eid, Dead)) continue;

        const ex = Position.x[eid];
        const ey = Position.y[eid];
        const myFaction = Faction.id[eid];

        for (let j = i + 1; j < ents.length; j++) {
          const other = ents[j];
          if (hasComponent(world, other, Dead)) continue;

          const dx = Position.x[other] - ex;
          const dy = Position.y[other] - ey;
          if (dx * dx + dy * dy > RELATIONSHIP_RANGE * RELATIONSHIP_RANGE) continue;

          if (Faction.id[other] === myFaction) {
            applySentiment(world, eid, other, ALLY_SENTIMENT_BOOST * seconds);
            applySentiment(world, other, eid, ALLY_SENTIMENT_BOOST * seconds);
          } else {
            applySentiment(world, eid, other, -ENEMY_SENTIMENT_PENALTY * seconds);
            applySentiment(world, other, eid, -ENEMY_SENTIMENT_PENALTY * seconds);
          }
        }
      }
    }

    // ── 2. Combat-based relationship degradation ────────────────────────
    const combatants = query(world, [Position, Combat, Faction]);
    for (let i = 0; i < combatants.length; i++) {
      const eid = combatants[i];
      if (hasComponent(world, eid, Dead)) continue;
      const targetEid = Combat.target[eid];
      if (
        targetEid < 0 ||
        !hasComponent(world, targetEid, Position) ||
        hasComponent(world, targetEid, Dead)
      )
        continue;

      applySentiment(world, eid, targetEid, -COMBAT_SENTIMENT_PENALTY * seconds);
      applySentiment(world, targetEid, eid, -COMBAT_SENTIMENT_PENALTY * seconds);
    }

    // ── 3. Resource sharing between friends ──────────────────────────────
    const inventoryEnts = query(world, [Position, Inventory, Faction]);
    for (let i = 0; i < inventoryEnts.length; i++) {
      const eid = inventoryEnts[i];
      if (hasComponent(world, eid, Dead)) continue;
      if (!hasComponent(world, eid, Relationship)) continue;

      const count = Relationship.count[eid];
      const base = eid * MAX_RELATIONSHIPS;

      for (let s = 0; s < count; s++) {
        if (Relationship.type[base + s] !== 1) continue; // friend only

        const friendEid = Relationship.target[base + s];
        if (
          friendEid < 0 ||
          hasComponent(world, friendEid, Dead) ||
          !hasComponent(world, friendEid, Position) ||
          !hasComponent(world, friendEid, Inventory)
        ) {
          continue;
        }

        const dx = Position.x[friendEid] - Position.x[eid];
        const dy = Position.y[friendEid] - Position.y[eid];
        if (dx * dx + dy * dy > RESOURCE_SHARE_RANGE * RESOURCE_SHARE_RANGE) continue;

        const myFood = Inventory.food[eid];
        const friendFood = Inventory.food[friendEid];
        if (myFood > friendFood + 5) {
          const transfer = RESOURCE_SHARE_RATE * seconds;
          Inventory.food[eid] = Math.max(0, myFood - transfer);
          Inventory.food[friendEid] = Math.min(999, Inventory.food[friendEid] + transfer);
        }
      }
    }

    // ── 4. Enemy aggression boost ───────────────────────────────────────
    for (let i = 0; i < combatants.length; i++) {
      const eid = combatants[i];
      if (hasComponent(world, eid, Dead)) continue;
      if (!hasComponent(world, eid, Relationship)) continue;

      // Only boost aggression if entity doesn't already have a valid target
      if (Combat.target[eid] >= 0) continue;

      const count = Relationship.count[eid];
      const base = eid * MAX_RELATIONSHIPS;

      for (let s = 0; s < count; s++) {
        if (Relationship.type[base + s] !== 2) continue; // enemy only

        const enemyEid = Relationship.target[base + s];
        if (
          enemyEid < 0 ||
          !hasComponent(world, enemyEid, Position) ||
          hasComponent(world, enemyEid, Dead)
        )
          continue;

        const dx = Position.x[enemyEid] - Position.x[eid];
        const dy = Position.y[enemyEid] - Position.y[eid];
        if (dx * dx + dy * dy <= ENEMY_AGGRO_EXTENSION * ENEMY_AGGRO_EXTENSION) {
          Combat.target[eid] = enemyEid;
          break;
        }
      }
    }

    // ── 5. Compact relationship slots (throttled) ────────────────────────
    compactCounter++;
    if (compactCounter % 60 === 0) {
      compactRelationships(world);
    }
  };
}
