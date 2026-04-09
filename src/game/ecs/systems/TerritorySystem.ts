import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Faction from '../components/Faction.js';
import Structure from '../components/Structure.js';
import { Dead } from '../components/TagComponents.js';
import { TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from '@/core/Constants.js';
import { eventBus } from '@/core/EventBus.js';

/** Each zone is 16x16 tiles = 512x512 pixels. */
const ZONE_TILES = 16;
const ZONE_PX = ZONE_TILES * TILE_SIZE;
/** World is 256x256 tiles -> 16x16 zones. */
const ZONES_X = WORLD_TILES_X / ZONE_TILES; // 16
const ZONES_Y = WORLD_TILES_Y / ZONE_TILES; // 16
const TOTAL_ZONES = ZONES_X * ZONES_Y; // 256
const MAX_FACTIONS = 10;

/** 0 = unclaimed, 1+ = faction ID. */
const territoryGrid = new Uint8Array(TOTAL_ZONES);

/** Tick every 5s at ~60fps = 300 frames. */
const TICK_FRAMES = 300;

/**
 * Get the faction that owns the zone at (zoneX, zoneY).
 * Returns 0 if unclaimed.
 */
export function getTerritoryOwner(zoneX: number, zoneY: number): number {
  if (zoneX < 0 || zoneY < 0 || zoneX >= ZONES_X || zoneY >= ZONES_Y) return 0;
  return territoryGrid[zoneY * ZONES_X + zoneX]!;
}

/**
 * Count how many zones a faction owns.
 */
export function getFactionTerritoryCount(factionId: number): number {
  let count = 0;
  for (let i = 0; i < TOTAL_ZONES; i++) {
    if (territoryGrid[i] === factionId) count++;
  }
  return count;
}

/**
 * Check if a world position is in a given faction's territory.
 */
export function isInOwnTerritory(factionId: number, wx: number, wy: number): boolean {
  const zx = Math.floor(wx / ZONE_PX);
  const zy = Math.floor(wy / ZONE_PX);
  return getTerritoryOwner(zx, zy) === factionId;
}

/**
 * Get a copy of the current territory grid.
 */
export function getTerritoryGrid(): Uint8Array {
  return new Uint8Array(territoryGrid);
}

export function createTerritorySystem(): (world: GameWorld, delta: number) => void {
  let frameCounter = 0;

  return (world: GameWorld, _delta: number): void => {
    frameCounter++;
    if (frameCounter % TICK_FRAMES !== 0) return;

    // ── Count buildings per faction per zone ────────────────────────────
    const counts = new Uint16Array(TOTAL_ZONES * MAX_FACTIONS);

    const buildings = query(world, [Position, Faction, Structure]);
    for (let i = 0; i < buildings.length; i++) {
      const eid = buildings[i]!;
      if (hasComponent(world, eid, Dead)) continue;

      const fid = Math.floor(Faction.id[eid]);
      if (fid <= 0 || fid >= MAX_FACTIONS) continue;

      const zx = Math.floor(Position.x[eid] / ZONE_PX);
      const zy = Math.floor(Position.y[eid] / ZONE_PX);
      if (zx < 0 || zy < 0 || zx >= ZONES_X || zy >= ZONES_Y) continue;

      counts[(zy * ZONES_X + zx) * MAX_FACTIONS + fid]++;
    }

    // ── Determine zone ownership (faction with most buildings) ──────────
    let changed = false;
    for (let z = 0; z < TOTAL_ZONES; z++) {
      let bestFaction = 0;
      let bestCount = 0;

      for (let f = 1; f < MAX_FACTIONS; f++) {
        const c = counts[z * MAX_FACTIONS + f]!;
        if (c > bestCount) {
          bestCount = c;
          bestFaction = f;
        }
      }

      // Need at least 1 building to claim
      if (bestCount === 0) bestFaction = 0;

      if (territoryGrid[z] !== bestFaction) {
        territoryGrid[z] = bestFaction;
        changed = true;
      }
    }

    if (changed) {
      eventBus.emit('territory:updated', { grid: new Uint8Array(territoryGrid) });
    }
  };
}
