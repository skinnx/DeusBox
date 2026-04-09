import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Faction from '../components/Faction.js';
import Structure from '../components/Structure.js';
import { Dead } from '../components/TagComponents.js';
import { eventBus } from '@/core/EventBus.js';
import { TechType } from '@/core/Types.js';
import techsData from '@/data/techs.json';

const MAX_FACTIONS = 10;

interface TechConfig {
  tier: number;
  cost: number;
  researchTime: number;
  requires: string[] | null;
  unlocks: {
    buildings?: string[];
    equipment?: string[];
    roles?: string[];
    modifier?: string;
  };
}

const TECH_CONFIGS = techsData as unknown as Record<string, TechConfig>;
const TECH_IDS = Object.keys(TECH_CONFIGS) as string[];

/** Per-faction unlocked tech set. */
const factionTechs: Map<number, Set<string>> = new Map();
/** Per-faction active research. */
const activeResearch: Map<number, string> = new Map();
/** Per-faction research progress (points accumulated). */
const researchProgress: Map<number, number> = new Map();

/** Research points per second per temple. +0.5 per Structure.level. */
const BASE_RESEARCH_SPEED = 1;

function getFactionTechSet(factionId: number): Set<string> {
  if (!factionTechs.has(factionId)) {
    factionTechs.set(factionId, new Set());
  }
  return factionTechs.get(factionId)!;
}

// ── Public API ───────────────────────────────────────────────────────────

export function isTechUnlocked(factionId: number, techType: string): boolean {
  return getFactionTechSet(factionId).has(techType);
}

export function getUnlockedTechs(factionId: number): ReadonlySet<string> {
  return getFactionTechSet(factionId);
}

export function getActiveResearch(factionId: number): string | null {
  return activeResearch.get(factionId) ?? null;
}

export function getFactionResearchProgress(factionId: number): number {
  const techId = activeResearch.get(factionId);
  if (!techId) return 0;
  const config = TECH_CONFIGS[techId];
  if (!config) return 0;
  const progress = researchProgress.get(factionId) ?? 0;
  return Math.min(1, progress / config.researchTime);
}

/**
 * Check if a faction can build a specific building type.
 * Returns true if the building doesn't require tech unlock, or if tech is unlocked.
 */
export function canBuild(factionId: number, buildingType: string): boolean {
  for (const [techId, config] of Object.entries(TECH_CONFIGS)) {
    if (config.unlocks.buildings?.includes(buildingType)) {
      if (!isTechUnlocked(factionId, techId)) return false;
    }
  }
  return true;
}

/**
 * Check if a faction can equip a specific equipment type.
 * Returns true if the equipment doesn't require tech, or if tech is unlocked.
 */
export function canEquip(factionId: number, equipmentId: string): boolean {
  for (const [techId, config] of Object.entries(TECH_CONFIGS)) {
    if (config.unlocks.equipment?.includes(equipmentId)) {
      if (!isTechUnlocked(factionId, techId)) return false;
    }
  }
  return true;
}

/**
 * Check if a faction can assign a specific military role.
 */
export function canAssignRole(factionId: number, roleId: string): boolean {
  for (const [techId, config] of Object.entries(TECH_CONFIGS)) {
    if (config.unlocks.roles?.includes(roleId)) {
      if (!isTechUnlocked(factionId, techId)) return false;
    }
  }
  return true;
}

/**
 * Check if a faction has a specific modifier from unlocked techs.
 */
export function hasTechModifier(factionId: number, modifier: string): boolean {
  for (const techId of getFactionTechSet(factionId)) {
    const config = TECH_CONFIGS[techId];
    if (config?.unlocks.modifier === modifier) return true;
  }
  return false;
}

/**
 * Check prerequisites for a tech.
 */
function prerequisitesMet(factionId: number, techId: string): boolean {
  const config = TECH_CONFIGS[techId];
  if (!config || !config.requires) return true;
  for (const req of config.requires) {
    if (!isTechUnlocked(factionId, req)) return false;
  }
  return true;
}

/**
 * Check if a faction can research a tech.
 */
function canResearch(factionId: number, techId: string): boolean {
  if (isTechUnlocked(factionId, techId)) return false;
  if (!prerequisitesMet(factionId, techId)) return false;
  return TECH_CONFIGS[techId] !== undefined;
}

/**
 * Start researching a tech for a faction.
 */
export function startResearch(factionId: number, techId: string): boolean {
  if (!canResearch(factionId, techId)) return false;
  activeResearch.set(factionId, techId);
  researchProgress.set(factionId, 0);
  eventBus.emit('research:started', { factionId, techId });
  return true;
}

/**
 * Pick the cheapest available tech (lowest tier, then lowest cost).
 */
function pickCheapestTech(factionId: number): string | null {
  let best: string | null = null;
  let bestTier = Infinity;
  let bestCost = Infinity;

  for (const techId of TECH_IDS) {
    if (!canResearch(factionId, techId)) continue;
    const config = TECH_CONFIGS[techId]!;
    if (config.tier < bestTier || (config.tier === bestTier && config.cost < bestCost)) {
      best = techId;
      bestTier = config.tier;
      bestCost = config.cost;
    }
  }
  return best;
}

/**
 * Get save data for tech state.
 */
export function getTechSaveData(): {
  unlocked: Map<number, string[]>;
  active: Map<number, string | null>;
  progress: Map<number, number>;
} {
  const unlocked = new Map<number, string[]>();
  const active = new Map<number, string | null>();
  const progress = new Map<number, number>();

  for (const [fid, techSet] of factionTechs) {
    unlocked.set(fid, Array.from(techSet));
  }
  for (const [fid, tech] of activeResearch) {
    active.set(fid, tech);
  }
  for (const [fid, prog] of researchProgress) {
    progress.set(fid, prog);
  }

  return { unlocked, active, progress };
}

/**
 * Restore tech state from save data.
 */
export function restoreTechSaveData(data: {
  unlocked: Map<number, string[]>;
  active: Map<number, string | null>;
  progress: Map<number, number>;
}): void {
  factionTechs.clear();
  activeResearch.clear();
  researchProgress.clear();

  for (const [fid, techs] of data.unlocked) {
    factionTechs.set(fid, new Set(techs));
  }
  for (const [fid, tech] of data.active) {
    if (tech) activeResearch.set(fid, tech);
  }
  for (const [fid, prog] of data.progress) {
    researchProgress.set(fid, prog);
  }
}

// ── System factory ───────────────────────────────────────────────────────

/**
 * Creates the tech system.
 *
 * Each tick:
 * - Counts temples per faction → research points per second
 *   (1 base + 0.5 per Structure.level)
 * - Advances progress (progress in seconds toward researchTime)
 * - Completes when progress >= researchTime
 * - Auto-picks cheapest available tech every 60s if idle
 */
export function createTechSystem(): (world: GameWorld, delta: number) => void {
  let autoTimer = 0;

  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;

    // ── Calculate research speed per faction ────────────────────────────
    const researchSpeed = new Float32Array(MAX_FACTIONS);
    const buildings = query(world, [Faction, Structure]);

    for (let i = 0; i < buildings.length; i++) {
      const eid = buildings[i]!;
      if (hasComponent(world, eid, Dead)) continue;
      const fid = Math.floor(Faction.id[eid]);
      if (fid < 0 || fid >= MAX_FACTIONS) continue;
      // Structure.type 4 = Temple
      if (Structure.type[eid] === 4) {
        const level = Structure.level[eid] ?? 0;
        researchSpeed[fid] += BASE_RESEARCH_SPEED + 0.5 * level;
      }
    }

    // ── Advance research per faction ───────────────────────────────────
    for (let f = 0; f < MAX_FACTIONS; f++) {
      if (researchSpeed[f] === 0) continue;

      const techId = activeResearch.get(f);
      if (!techId) continue;

      const config = TECH_CONFIGS[techId];
      if (!config) continue;

      const progress = (researchProgress.get(f) ?? 0) + researchSpeed[f]! * seconds;
      researchProgress.set(f, progress);

      if (progress >= config.researchTime) {
        researchProgress.set(f, 0);
        activeResearch.delete(f);
        getFactionTechSet(f).add(techId);
        eventBus.emit('research:completed', { factionId: f, techId });
      }
    }

    // ── Auto-research: every 60s pick cheapest available tech ───────────
    autoTimer += delta;
    if (autoTimer >= 60000) {
      autoTimer = 0;

      for (let f = 0; f < MAX_FACTIONS; f++) {
        if (researchSpeed[f] === 0) continue;
        if (activeResearch.has(f)) continue;

        const cheapest = pickCheapestTech(f);
        if (cheapest) {
          startResearch(f, cheapest);
        }
      }
    }
  };
}
