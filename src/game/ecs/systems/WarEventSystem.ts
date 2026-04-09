import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import Faction from '../components/Faction.js';
import Combat from '../components/Combat.js';
import Structure from '../components/Structure.js';
import MilitaryRole from '../components/MilitaryRole.js';
import { Dead, Building, Creature } from '../components/TagComponents.js';
import { spawnCreature } from '../factories/CreatureFactory.js';
import { spatialHash } from './SpatialIndexSystem.js';
import { getTerritoryOwner } from './TerritorySystem.js';
import { eventBus } from '@/core/EventBus.js';
import { TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from '@/core/Constants.js';
import territoryConfig from '@/data/territory.json';

// ── Tuning constants ────────────────────────────────────────────────────

/** Minimum ms between war evaluations */
const WAR_CHECK_INTERVAL = 15_000;
/** Minimum ms between war events */
const WAR_COOLDOWN_MIN = 45_000;
/** Maximum ms between war events */
const WAR_COOLDOWN_MAX = 90_000;
/** Territory conflict score threshold for war */
const WAR_TERRITORY_THRESHOLD = 3;
/** Minimum military units a faction needs to start a war */
const MIN_MILITARY_FOR_WAR = 3;
/** Number of reinforcements spawned in a war mobilization */
const MOBILIZATION_COUNT = 4;

// ── Internal types ──────────────────────────────────────────────────────

interface WarState {
  lastCheckElapsed: number;
  cooldownUntil: number;
  /** Active wars: Set of "factionA-factionB" keys */
  activeWars: Set<string>;
  /** Track war start times */
  warStartTimes: Map<string, number>;
  /** Faction military strength cache */
  factionMilitaryStrength: Map<number, number>;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function randFloat(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

function warKey(factionA: number, factionB: number): string {
  return factionA < factionB ? `${factionA}-${factionB}` : `${factionB}-${factionA}`;
}

// ── War event implementations ───────────────────────────────────────────

/**
 * Declares war between two factions. Emits events and spawns attack force.
 */
function triggerWarDeclaration(
  world: GameWorld,
  attackerFaction: number,
  defenderFaction: number,
  state: WarState,
): void {
  const key = warKey(attackerFaction, defenderFaction);
  state.activeWars.add(key);
  state.warStartTimes.set(key, world.time.elapsed);

  // Spawn attacker reinforcements near defender territory
  const worldW = WORLD_TILES_X * TILE_SIZE;
  const worldH = WORLD_TILES_Y * TILE_SIZE;

  // Find a defender building as target
  const buildings = query(world, [Position, Structure, Building]);
  let targetX = worldW / 2;
  let targetY = worldH / 2;

  for (let i = 0; i < buildings.length; i++) {
    const eid = buildings[i]!;
    if (Structure.factionId[eid] === defenderFaction) {
      targetX = Position.x[eid];
      targetY = Position.y[eid];
      break;
    }
  }

  // Spawn attack force from world edge
  const spawnX = randFloat(0, worldW);
  const spawnY = randFloat(0, worldH);

  for (let i = 0; i < MOBILIZATION_COUNT; i++) {
    const type = i < MOBILIZATION_COUNT / 2 ? 'orc' : 'human';
    const eid = spawnCreature(
      world,
      type,
      spawnX + randFloat(-50, 50),
      spawnY + randFloat(-50, 50),
      attackerFaction,
    );
    if (eid >= 0) {
      // Set pathfinder target toward defender buildings
      const { default: Pathfinder } = require('../components/Pathfinder.js');
      if (hasComponent(world, eid, Pathfinder)) {
        Pathfinder.targetX[eid] = targetX + randFloat(-100, 100);
        Pathfinder.targetY[eid] = targetY + randFloat(-100, 100);
      }
    }
  }

  eventBus.emit('war:declared', {
    attackerFaction,
    defenderFaction,
    targetX,
    targetY,
  });

  eventBus.emit('storyteller:event', {
    type: 'war_declaration',
    data: { attackerFaction, defenderFaction },
  });
}

/**
 * Triggers a siege event — mobilizes military units toward an enemy building.
 */
function triggerSiegeEvent(world: GameWorld, attackerFaction: number, defenderFaction: number): void {
  // Find defender buildings
  const buildings = query(world, [Position, Structure, Building, Health]);
  let targetEid = -1;

  for (let i = 0; i < buildings.length; i++) {
    const eid = buildings[i]!;
    if (Structure.factionId[eid] === defenderFaction && !hasComponent(world, eid, Dead)) {
      targetEid = eid;
      break;
    }
  }

  if (targetEid < 0) return; // No buildings to siege

  const tx = Position.x[targetEid];
  const ty = Position.y[targetEid];

  // Direct nearby military units of attacker faction toward the building
  const militaryUnits = query(world, [Position, Combat, Faction, MilitaryRole]);

  for (let i = 0; i < militaryUnits.length; i++) {
    const eid = militaryUnits[i]!;
    if (Faction.id[eid] !== attackerFaction) continue;
    if (hasComponent(world, eid, Dead)) continue;
    if (MilitaryRole.role[eid] === 0) continue;

    const dx = Position.x[eid] - tx;
    const dy = Position.y[eid] - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only redirect units within a reasonable range
    if (dist < TILE_SIZE * 30) {
      const { default: Pathfinder } = require('../components/Pathfinder.js');
      if (hasComponent(world, eid, Pathfinder)) {
        Pathfinder.targetX[eid] = tx + randFloat(-50, 50);
        Pathfinder.targetY[eid] = ty + randFloat(-50, 50);
      }
      // Set combat state
      const { default: AIStateComponent } = require('../components/AIState.js');
      if (hasComponent(world, eid, AIStateComponent)) {
        const { AIState } = require('@/core/Types.js');
        AIStateComponent.state[eid] = AIState.Fighting as unknown as number;
      }
    }
  }

  eventBus.emit('storyteller:event', {
    type: 'siege_mobilization',
    data: { attackerFaction, defenderFaction, targetX: tx, targetY: ty },
  });
}

/**
 * Triggers a raid — spawns hostile attackers from world edge toward a faction.
 */
function triggerWarRaid(world: GameWorld, attackerFaction: number, defenderFaction: number): void {
  const worldW = WORLD_TILES_X * TILE_SIZE;
  const worldH = WORLD_TILES_Y * TILE_SIZE;

  // Find defender position
  const creatures = query(world, [Position, Faction, Creature, Health]);
  let targetX = worldW / 2;
  let targetY = worldH / 2;

  for (let i = 0; i < creatures.length; i++) {
    const eid = creatures[i]!;
    if (Faction.id[eid] === defenderFaction && !hasComponent(world, eid, Dead)) {
      targetX = Position.x[eid];
      targetY = Position.y[eid];
      break;
    }
  }

  // Spawn raiders from edge
  const count = randInt(3, 6);
  const edge = randInt(0, 3);
  const types = ['orc', 'orc', 'wolf'] as const;

  for (let i = 0; i < count; i++) {
    let sx: number, sy: number;
    switch (edge) {
      case 0: sx = randFloat(0, worldW); sy = 0; break;
      case 1: sx = worldW; sy = randFloat(0, worldH); break;
      case 2: sx = randFloat(0, worldW); sy = worldH; break;
      default: sx = 0; sy = randFloat(0, worldH); break;
    }

    const type = types[randInt(0, types.length - 1)] as string;
    const eid = spawnCreature(world, type, sx, sy, attackerFaction);
    if (eid >= 0) {
      const { default: Pathfinder } = require('../components/Pathfinder.js');
      if (hasComponent(world, eid, Pathfinder)) {
        Pathfinder.targetX[eid] = targetX + randFloat(-150, 150);
        Pathfinder.targetY[eid] = targetY + randFloat(-150, 150);
      }
    }
  }

  eventBus.emit('storyteller:event', {
    type: 'war_raid',
    data: { attackerFaction, defenderFaction, count, targetX, targetY },
  });
}

// ── Faction strength analysis ───────────────────────────────────────────

function calculateFactionStrength(world: GameWorld): Map<number, number> {
  const strength = new Map<number, number>();
  const units = query(world, [Position, Combat, Faction, Health]);

  for (let i = 0; i < units.length; i++) {
    const eid = units[i]!;
    if (hasComponent(world, eid, Dead)) continue;

    const fid = Faction.id[eid];
    const power = Combat.attackPower[eid];
    const hpFrac = Health.current[eid] / Math.max(1, Health.max[eid]);

    strength.set(fid, (strength.get(fid) ?? 0) + power * hpFrac);
  }

  return strength;
}

function countMilitaryUnits(world: GameWorld, factionId: number): number {
  const units = query(world, [Combat, Faction, MilitaryRole]);
  let count = 0;
  for (let i = 0; i < units.length; i++) {
    const eid = units[i]!;
    if (Faction.id[eid] === factionId && MilitaryRole.role[eid] > 0 && !hasComponent(world, eid, Dead)) {
      count++;
    }
  }
  return count;
}

// ── Territory conflict detection ────────────────────────────────────────

interface TerritoryConflict {
  factionA: number;
  factionB: number;
  borderChunks: number;
}

function detectTerritoryConflicts(world: GameWorld): TerritoryConflict[] {
  const conflicts: TerritoryConflict[] = [];
  const conflictMap = new Map<string, number>();

  // Check for factions in close proximity with low reputation
  const factionedEnts = query(world, [Position, Faction, Health]);
  const CHECK_RADIUS = TILE_SIZE * 8;

  for (let i = 0; i < factionedEnts.length; i++) {
    const eidA = factionedEnts[i]!;
    if (hasComponent(world, eidA, Dead)) continue;
    const factionA = Faction.id[eidA];

    for (let j = i + 1; j < factionedEnts.length; j++) {
      const eidB = factionedEnts[j]!;
      if (hasComponent(world, eidB, Dead)) continue;
      const factionB = Faction.id[eidB];

      if (factionA === factionB) continue;

      const dx = Position.x[eidA] - Position.x[eidB];
      const dy = Position.y[eidA] - Position.y[eidB];
      if (dx * dx + dy * dy > CHECK_RADIUS * CHECK_RADIUS) continue;

      // Low reputation means hostility
      const repA = Faction.reputation[eidA];
      const repB = Faction.reputation[eidB];
      if (repA > territoryConfig.warReputationThreshold && repB > territoryConfig.warReputationThreshold) continue;

      const key = warKey(factionA, factionB);
      conflictMap.set(key, (conflictMap.get(key) ?? 0) + 1);
    }
  }

  for (const [key, borderChunks] of conflictMap) {
    const [a, b] = key.split('-').map(Number);
    if (a !== undefined && b !== undefined && borderChunks >= WAR_TERRITORY_THRESHOLD) {
      conflicts.push({ factionA: a, factionB: b, borderChunks });
    }
  }

  return conflicts;
}

// ── System factory ──────────────────────────────────────────────────────

/**
 * Creates the WarEventSystem.
 * Monitors faction relations, territory conflicts, and military strength.
 * Triggers war declarations, siege mobilizations, and war raids.
 */
export function createWarEventSystem(): (world: GameWorld, delta: number) => void {
  const state: WarState = {
    lastCheckElapsed: 0,
    cooldownUntil: 0,
    activeWars: new Set(),
    warStartTimes: new Map(),
    factionMilitaryStrength: new Map(),
  };

  // Listen for territory loss events
  eventBus.on('territory:lost', (data: { factionId: number; chunkX: number; chunkY: number }) => {
    // Territory loss increases tension — will be picked up next evaluation
  });

  return (world: GameWorld, delta: number): void => {
    const elapsed = world.time.elapsed;

    // ── Throttle ──────────────────────────────────────────────────────
    if (elapsed - state.lastCheckElapsed < WAR_CHECK_INTERVAL) return;
    state.lastCheckElapsed = elapsed;

    // ── Update faction strength cache ─────────────────────────────────
    state.factionMilitaryStrength = calculateFactionStrength(world);

    // ── Check cooldown ────────────────────────────────────────────────
    if (elapsed < state.cooldownUntil) return;

    // ── Detect territory conflicts ────────────────────────────────────
    const conflicts = detectTerritoryConflicts(world);

    if (conflicts.length === 0) return;

    // Pick the most intense conflict
    conflicts.sort((a, b) => b.borderChunks - a.borderChunks);
    const conflict = conflicts[0]!;

    const key = warKey(conflict.factionA, conflict.factionB);

    // Check if already at war
    if (state.activeWars.has(key)) {
      // Already at war — trigger siege or raid events
      if (Math.random() < 0.5) {
        triggerSiegeEvent(world, conflict.factionA, conflict.factionB);
      } else {
        triggerWarRaid(world, conflict.factionA, conflict.factionB);
      }
    } else {
      // Not at war — check if should declare war
      const factionAMilitary = countMilitaryUnits(world, conflict.factionA);
      const factionBMilitary = countMilitaryUnits(world, conflict.factionB);

      // Both factions need sufficient military
      if (factionAMilitary >= MIN_MILITARY_FOR_WAR || factionBMilitary >= MIN_MILITARY_FOR_WAR) {
        // Stronger faction declares war
        const strengthA = state.factionMilitaryStrength.get(conflict.factionA) ?? 0;
        const strengthB = state.factionMilitaryStrength.get(conflict.factionB) ?? 0;

        const attacker = strengthA >= strengthB ? conflict.factionA : conflict.factionB;
        const defender = strengthA >= strengthB ? conflict.factionB : conflict.factionA;

        triggerWarDeclaration(world, attacker, defender, state);
      }
    }

    // ── Set cooldown ──────────────────────────────────────────────────
    state.cooldownUntil = elapsed + randFloat(WAR_COOLDOWN_MIN, WAR_COOLDOWN_MAX);

    // ── Clean up stale wars ───────────────────────────────────────────
    const staleThreshold = elapsed - 300_000; // 5 minutes
    for (const [warKeyStr, startTime] of state.warStartTimes) {
      if (startTime < staleThreshold) {
        state.activeWars.delete(warKeyStr);
        state.warStartTimes.delete(warKeyStr);

        const [a, b] = warKeyStr.split('-').map(Number);
        eventBus.emit('war:ended', {
          factionA: a,
          factionB: b,
          duration: elapsed - startTime,
        });
      }
    }
  };
}
