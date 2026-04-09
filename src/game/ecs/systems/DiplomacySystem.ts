import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Faction from '../components/Faction.js';
import Structure from '../components/Structure.js';
import Combat from '../components/Combat.js';
import { Dead } from '../components/TagComponents.js';
import { eventBus } from '@/core/EventBus.js';
import { DiplomacyState, BuildingType } from '@/core/Types.js';

const MAX_FACTIONS = 10;

/** Diplomacy matrix: diplomacy[a][b] = DiplomacyState. */
const diplomacy: DiplomacyState[][] = [];

/** War timestamps: warStart[a * MAX_FACTIONS + b] = elapsed ms when war started. */
const warStart = new Float32Array(MAX_FACTIONS * MAX_FACTIONS);

/** Ceasefire timestamps: ceasefireStart[a * MAX_FACTIONS + b] = elapsed ms. */
const ceasefireStart = new Float32Array(MAX_FACTIONS * MAX_FACTIONS);

function ensureInit(): void {
  if (diplomacy.length > 0) return;
  for (let i = 0; i < MAX_FACTIONS; i++) {
    diplomacy[i] = [];
    for (let j = 0; j < MAX_FACTIONS; j++) {
      diplomacy[i]![j] = i === j ? DiplomacyState.Allied : DiplomacyState.Neutral;
    }
  }
}

function setState(a: number, b: number, state: DiplomacyState): void {
  if (a === b) return;
  const prev = diplomacy[a]![b]!;
  if (prev !== state) {
    diplomacy[a]![b] = state;
    diplomacy[b]![a] = state;
    eventBus.emit('diplomacy:changed', { factionA: a, factionB: b, newState: state });
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export function getDiplomacyState(factionA: number, factionB: number): DiplomacyState {
  if (factionA === factionB) return DiplomacyState.Allied;
  if (factionA < 0 || factionB < 0 || factionA >= MAX_FACTIONS || factionB >= MAX_FACTIONS) {
    return DiplomacyState.Neutral;
  }
  ensureInit();
  return diplomacy[factionA]![factionB]!;
}

export function areFactionsHostile(factionA: number, factionB: number): boolean {
  if (factionA === factionB) return false;
  const state = getDiplomacyState(factionA, factionB);
  // Neutral (different factions) are still hostile in combat checks
  return state === DiplomacyState.AtWar || state === DiplomacyState.Neutral;
}

export function isAllied(factionA: number, factionB: number): boolean {
  return getDiplomacyState(factionA, factionB) === DiplomacyState.Allied;
}

/**
 * Get the full diplomacy matrix (for save/load).
 */
export function getDiplomacyMatrix(): string[][] {
  ensureInit();
  return diplomacy.map(row => row.map(s => s));
}

/**
 * Restore diplomacy matrix (for save/load).
 */
export function restoreDiplomacyMatrix(matrix: string[][]): void {
  for (let i = 0; i < MAX_FACTIONS && i < matrix.length; i++) {
    for (let j = 0; j < MAX_FACTIONS && j < matrix[i]!.length; j++) {
      const val = matrix[i]![j]!;
      if (Object.values(DiplomacyState).includes(val as DiplomacyState)) {
        diplomacy[i]![j] = val as DiplomacyState;
      }
    }
  }
}

// ── System factory ───────────────────────────────────────────────────────

/**
 * Creates the diplomacy system.
 *
 * Throttled to every ~30s (1800 frames at 60fps).
 *
 * War trigger: entity pair between factions with reputation < 25.
 * Peace trigger: war > 120s with no combat → Ceasefire → Neutral after 60s.
 * Alliance trigger: avg rep > 75, both have temples, common enemy.
 * Alliance break: reputation drop < 40 → Neutral.
 */
export function createDiplomacySystem(): (world: GameWorld, delta: number) => void {
  let frameCounter = 0;

  return (world: GameWorld, delta: number): void => {
    ensureInit();
    const elapsed = world.time.elapsed;

    frameCounter++;
    // Evaluate every ~30s at 60fps
    if (frameCounter % 1800 !== 0) return;

    const ents = query(world, [Faction]);

    // ── Gather per-faction data ────────────────────────────────────────
    const repSum = new Float32Array(MAX_FACTIONS);
    const repCount = new Float32Array(MAX_FACTIONS);
    const hasTemple = new Uint8Array(MAX_FACTIONS);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i]!;
      if (hasComponent(world, eid, Dead)) continue;
      const fid = Math.floor(Faction.id[eid]);
      if (fid < 0 || fid >= MAX_FACTIONS) continue;
      repSum[fid] += Faction.reputation[eid];
      repCount[fid]++;
    }

    // Check temples separately (buildings)
    const buildings = query(world, [Faction, Structure]);
    for (let i = 0; i < buildings.length; i++) {
      const eid = buildings[i]!;
      if (hasComponent(world, eid, Dead)) continue;
      const fid = Math.floor(Faction.id[eid]);
      if (fid > 0 && fid < MAX_FACTIONS) {
        // Structure.type 4 = Temple (from BuildingType index)
        if (Structure.type[eid] === 4) {
          hasTemple[fid] = 1;
        }
      }
    }

    // ── Check for active combat between faction pairs ──────────────────
    const combatBetween = new Uint8Array(MAX_FACTIONS * MAX_FACTIONS);
    const combatants = query(world, [Combat, Faction]);
    for (let i = 0; i < combatants.length; i++) {
      const eid = combatants[i]!;
      const myFaction = Math.floor(Faction.id[eid]);
      const targetEid = Combat.target[eid];
      if (targetEid < 0) continue;
      if (!hasComponent(world, targetEid, Faction)) continue;
      const targetFaction = Math.floor(Faction.id[targetEid]);
      if (myFaction !== targetFaction && myFaction >= 0 && targetFaction >= 0 &&
          myFaction < MAX_FACTIONS && targetFaction < MAX_FACTIONS) {
        combatBetween[myFaction * MAX_FACTIONS + targetFaction] = 1;
        combatBetween[targetFaction * MAX_FACTIONS + myFaction] = 1;
      }
    }

    // ── Evaluate each pair ─────────────────────────────────────────────
    for (let a = 0; a < MAX_FACTIONS; a++) {
      if (repCount[a] === 0) continue;
      for (let b = a + 1; b < MAX_FACTIONS; b++) {
        if (repCount[b] === 0) continue;

        const current = diplomacy[a]![b]!;
        const avgRepA = repSum[a] / repCount[a]!;
        const avgRepB = repSum[b] / repCount[b]!;
        const avgRep = (avgRepA + avgRepB) / 2;

        const warKey = a * MAX_FACTIONS + b;

        switch (current) {
          case DiplomacyState.Neutral: {
            // War trigger: any entity with rep < 25 toward other faction
            let hasLowRep = false;
            for (let i = 0; i < ents.length; i++) {
              const eid = ents[i]!;
              if (hasComponent(world, eid, Dead)) continue;
              const fid = Math.floor(Faction.id[eid]);
              if ((fid === a || fid === b) && Faction.reputation[eid] < 25) {
                hasLowRep = true;
                break;
              }
            }
            if (hasLowRep) {
              setState(a, b, DiplomacyState.AtWar);
              warStart[warKey] = elapsed;
            }

            // Alliance trigger: avg rep > 75, both have temples, common enemy
            const commonEnemy = hasCommonEnemy(a, b);
            if (avgRep > 75 && hasTemple[a] && hasTemple[b] && commonEnemy) {
              setState(a, b, DiplomacyState.Allied);
            }
            break;
          }

          case DiplomacyState.AtWar: {
            // Ceasefire: war > 120s with no combat between factions
            const warDuration = elapsed - warStart[warKey];
            if (warDuration > 120000 && !combatBetween[warKey]) {
              setState(a, b, DiplomacyState.Ceasefire);
              ceasefireStart[warKey] = elapsed;
            }
            break;
          }

          case DiplomacyState.Ceasefire: {
            // Re-escalate if combat resumes
            if (combatBetween[warKey]) {
              setState(a, b, DiplomacyState.AtWar);
              warStart[warKey] = elapsed;
              break;
            }
            // Neutral after 60s of ceasefire without combat
            const ceasefireDuration = elapsed - ceasefireStart[warKey];
            if (ceasefireDuration > 60000) {
              setState(a, b, DiplomacyState.Neutral);
            }
            break;
          }

          case DiplomacyState.Allied: {
            // Alliance break: avg rep < 40
            if (avgRep < 40) {
              setState(a, b, DiplomacyState.Neutral);
            }
            break;
          }
        }
      }
    }
  };
}

/**
 * Check if two factions share a common enemy (AtWar with the same third faction).
 */
function hasCommonEnemy(a: number, b: number): boolean {
  for (let c = 0; c < MAX_FACTIONS; c++) {
    if (c === a || c === b) continue;
    if (diplomacy[a]![c] === DiplomacyState.AtWar && diplomacy[b]![c] === DiplomacyState.AtWar) {
      return true;
    }
  }
  return false;
}
