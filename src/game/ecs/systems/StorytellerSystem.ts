import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import Needs from '../components/Needs.js';
import Faction from '../components/Faction.js';
import Pathfinder from '../components/Pathfinder.js';
import { Creature, Dead } from '../components/TagComponents.js';
import { eventBus } from '@/core/EventBus.js';
import { spawnCreature } from '@/game/ecs/factories/CreatureFactory.js';
import { TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from '@/core/Constants.js';

// ── Tuning constants ───────────────────────────────────────────────────────

/** Minimum elapsed ms between storyteller evaluations. */
const CHECK_INTERVAL_MS = 10_000;
/** Minimum ms between triggered events. */
const COOLDOWN_MIN_MS = 30_000;
/** Maximum ms between triggered events (randomised within range). */
const COOLDOWN_MAX_MS = 60_000;
/** Window (ms) in which combat deaths contribute to drama. */
const DEATH_WINDOW_MS = 30_000;

// ── Drama weight constants (each contributes up to its value) ──────────────

const WEIGHT_HEALTH = 30;
const WEIGHT_HUNGER = 25;
const WEIGHT_DEATHS = 25;
const WEIGHT_IMBALANCE = 20;

// ── Internal types ─────────────────────────────────────────────────────────

interface DeathRecord {
  time: number;
}

interface StorytellerState {
  lastCheckElapsed: number;
  cooldownUntil: number;
  recentDeaths: DeathRecord[];
  dramaScore: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Pick a random integer in [lo, hi] inclusive. */
function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Return a random float in [lo, hi). */
function randFloat(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

// ── Event implementations ──────────────────────────────────────────────────

function triggerMigration(world: GameWorld, centerX: number, centerY: number): void {
  const count = randInt(3, 5);
  const clusterRadius = 60;
  const types = ['deer', 'wolf'] as const;

  for (let i = 0; i < count; i++) {
    const type = types[randInt(0, types.length - 1)] as string;
    const x = Math.max(0, centerX + randFloat(-clusterRadius, clusterRadius));
    const y = Math.max(0, centerY + randFloat(-clusterRadius, clusterRadius));
    spawnCreature(world, type, x, y, 0);
  }

  eventBus.emit('storyteller:event', {
    type: 'migration',
    data: { centerX, centerY, count },
  });
}

function triggerPlague(world: GameWorld, centerX: number, centerY: number): void {
  const radius = 200;
  const damageFraction = 0.3;
  const ents = query(world, [Position, Health, Creature]);

  for (let i = 0; i < ents.length; i++) {
    const eid = ents[i];
    if (hasComponent(world, eid, Dead)) continue;

    const dx = Position.x[eid] - centerX;
    const dy = Position.y[eid] - centerY;
    if (dx * dx + dy * dy > radius * radius) continue;

    const maxHp = Health.max[eid];
    Health.current[eid] = Math.max(1, Health.current[eid] - maxHp * damageFraction);
  }

  eventBus.emit('storyteller:event', {
    type: 'plague',
    data: { centerX, centerY, radius },
  });
}

function triggerRaid(world: GameWorld): void {
  const count = randInt(5, 8);
  const worldW = WORLD_TILES_X * TILE_SIZE;
  const worldH = WORLD_TILES_Y * TILE_SIZE;
  const targetX = worldW / 2;
  const targetY = worldH / 2;

  // Pick a random world edge
  const edge = randInt(0, 3);
  let spawnX: number;
  let spawnY: number;

  for (let i = 0; i < count; i++) {
    switch (edge) {
      case 0: // top
        spawnX = randFloat(0, worldW);
        spawnY = 0;
        break;
      case 1: // right
        spawnX = worldW;
        spawnY = randFloat(0, worldH);
        break;
      case 2: // bottom
        spawnX = randFloat(0, worldW);
        spawnY = worldH;
        break;
      default: {
        // left
        spawnX = 0;
        spawnY = randFloat(0, worldH);
        break;
      }
    }

    const type = i < count / 2 ? 'wolf' : 'orc';
    const eid = spawnCreature(world, type, spawnX, spawnY, 3); // hostile faction

    // Direct raiders toward the world centre
    if (eid >= 0 && hasComponent(world, eid, Pathfinder)) {
      Pathfinder.targetX[eid] = targetX + randFloat(-200, 200);
      Pathfinder.targetY[eid] = targetY + randFloat(-200, 200);
    }
  }

  eventBus.emit('storyteller:event', {
    type: 'raid',
    data: { count, edge, targetX, targetY },
  });
}

function triggerEarthquake(world: GameWorld, centerX: number, centerY: number): void {
  const radius = 300;
  const damage = 40;
  const ents = query(world, [Position, Health, Creature]);

  for (let i = 0; i < ents.length; i++) {
    const eid = ents[i];
    if (hasComponent(world, eid, Dead)) continue;

    const dx = Position.x[eid] - centerX;
    const dy = Position.y[eid] - centerY;
    if (dx * dx + dy * dy > radius * radius) continue;

    Health.current[eid] = Math.max(1, Health.current[eid] - damage);
  }

  eventBus.emit('storyteller:event', {
    type: 'earthquake',
    data: { centerX, centerY, radius, damage },
  });

  // Also emit disaster event for existing listeners
  eventBus.emit('disaster:start', {
    type: 'earthquake',
    centerX,
    centerY,
    radius,
  });
}

function triggerMassPanic(world: GameWorld, centerX: number, centerY: number): void {
  // Mass panic is expressed as a storyteller event; combat + AI systems
  // can react to the event independently.
  const radius = 250;

  eventBus.emit('storyteller:event', {
    type: 'mass_panic',
    data: { centerX, centerY, radius },
  });
}

// ── Drama score calculation ────────────────────────────────────────────────

function calculateDrama(world: GameWorld, state: StorytellerState, elapsed: number): number {
  const ents = query(world, [Health, Creature]);

  if (ents.length === 0) return 0;

  let totalHealthFrac = 0;
  let totalHunger = 0;
  let liveCount = 0;

  for (let i = 0; i < ents.length; i++) {
    const eid = ents[i];
    if (hasComponent(world, eid, Dead)) continue;

    const maxHp = Health.max[eid];
    totalHealthFrac += maxHp > 0 ? Health.current[eid] / maxHp : 1;

    if (hasComponent(world, eid, Needs)) {
      totalHunger += Needs.hunger[eid];
    }
    liveCount++;
  }

  if (liveCount === 0) return 0;

  const avgHealth = totalHealthFrac / liveCount;
  const avgHunger = totalHunger / liveCount;

  // ── Health component (low health → high drama) ────────────────────
  const healthDrama = (1 - avgHealth) * WEIGHT_HEALTH;

  // ── Hunger component (high hunger → high drama) ───────────────────
  const hungerDrama = Math.min(1, avgHunger / 100) * WEIGHT_HUNGER;

  // ── Recent combat deaths ───────────────────────────────────────────
  const cutoff = elapsed - DEATH_WINDOW_MS;
  let recentCount = 0;
  for (let i = state.recentDeaths.length - 1; i >= 0; i--) {
    if (state.recentDeaths[i].time < cutoff) break;
    recentCount++;
  }
  // Remove expired entries
  let writeIdx = 0;
  for (let i = 0; i < state.recentDeaths.length; i++) {
    if (state.recentDeaths[i].time >= cutoff) {
      state.recentDeaths[writeIdx++] = state.recentDeaths[i];
    }
  }
  state.recentDeaths.length = writeIdx;
  const deathDrama = Math.min(1, recentCount / 10) * WEIGHT_DEATHS;

  // ── Faction population imbalance ───────────────────────────────────
  const factionCounts = new Map<number, number>();
  const factionedEnts = query(world, [Faction, Creature]);
  for (let i = 0; i < factionedEnts.length; i++) {
    const eid = factionedEnts[i];
    if (hasComponent(world, eid, Dead)) continue;
    const fid = Faction.id[eid];
    factionCounts.set(fid, (factionCounts.get(fid) ?? 0) + 1);
  }

  let imbalanceDrama = 0;
  if (factionCounts.size >= 2) {
    const counts = Array.from(factionCounts.values());
    const maxPop = Math.max(...counts);
    const totalPop = counts.reduce((a, b) => a + b, 0);
    const imbalanceRatio = totalPop > 0 ? maxPop / totalPop : 0;
    imbalanceDrama = Math.max(0, imbalanceRatio - 0.5) * 2 * WEIGHT_IMBALANCE;
  }

  return Math.min(100, healthDrama + hungerDrama + deathDrama + imbalanceDrama);
}

// ── System factory ─────────────────────────────────────────────────────────

/**
 * Dependencies injected from GameScene.
 */
export interface StorytellerDeps {
  /** World dimensions in pixels (for edge spawning). */
  worldWidth: number;
  worldHeight: number;
}

/**
 * Creates the AI Storyteller system.
 *
 * Monitors world state every 10 s of game time, computes a drama score,
 * and triggers narrative events when drama thresholds are crossed and the
 * cooldown has elapsed.
 *
 * Drama thresholds:
 *   20-40: migration (spawn deer/wolves)
 *   40-60: plague (area health reduction)
 *   60-80: raid (hostile creatures from world edge)
 *   80+:   earthquake / mass panic
 */
export function createStorytellerSystem(
  deps: StorytellerDeps,
): (world: GameWorld, delta: number) => void {
  const state: StorytellerState = {
    lastCheckElapsed: 0,
    cooldownUntil: 0,
    recentDeaths: [],
    dramaScore: 0,
  };

  // Capture current elapsed time in closure so the event handler can use it
  let currentElapsed = 0;

  eventBus.on('entity:destroyed', (data) => {
    state.recentDeaths.push({ time: currentElapsed });
    // Cap list size to prevent unbounded growth
    if (state.recentDeaths.length > 200) {
      state.recentDeaths.splice(0, state.recentDeaths.length - 200);
    }
  });

  return (world: GameWorld, delta: number): void => {
    const elapsed = world.time.elapsed;
    currentElapsed = elapsed;

    // ── Throttle to every CHECK_INTERVAL_MS ──────────────────────────
    if (elapsed - state.lastCheckElapsed < CHECK_INTERVAL_MS) return;
    state.lastCheckElapsed = elapsed;

    // ── Calculate drama ──────────────────────────────────────────────
    state.dramaScore = calculateDrama(world, state, elapsed);

    // ── Check cooldown ───────────────────────────────────────────────
    if (elapsed < state.cooldownUntil) return;

    const drama = state.dramaScore;

    // Pick a world-centre-ish point for localised events
    const cx = deps.worldWidth / 2 + randFloat(-400, 400);
    const cy = deps.worldHeight / 2 + randFloat(-400, 400);

    if (drama >= 80) {
      if (Math.random() < 0.5) {
        triggerEarthquake(world, cx, cy);
      } else {
        triggerMassPanic(world, cx, cy);
      }
    } else if (drama >= 60) {
      triggerRaid(world);
    } else if (drama >= 40) {
      triggerPlague(world, cx, cy);
    } else if (drama >= 20) {
      triggerMigration(world, cx, cy);
    } else {
      return; // below threshold – no event
    }

    // Set cooldown for next event
    state.cooldownUntil = elapsed + randFloat(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS);
  };
}
