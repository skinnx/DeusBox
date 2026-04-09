import type { GameWorld } from '../ECSHost.js';
import { eventBus } from '@/core/EventBus.js';
import { Season } from '@/core/Types.js';
import weatherConfig from '@/data/weather.json';

const SEASON_DURATION = weatherConfig.seasonDuration; // 75000ms per season

let currentSeason: Season = Season.Spring;

/**
 * Returns the current season based on elapsed game time.
 */
export function getCurrentSeason(elapsed: number): Season {
  const t = elapsed % (SEASON_DURATION * 4);
  if (t < SEASON_DURATION) return Season.Spring;
  if (t < SEASON_DURATION * 2) return Season.Summer;
  if (t < SEASON_DURATION * 3) return Season.Autumn;
  return Season.Winter;
}

/**
 * Returns the module-level cached current season.
 * Updated each tick by the season system.
 */
export function getCachedSeason(): Season {
  return currentSeason;
}

export function createSeasonSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, _delta: number): void => {
    const elapsed = world.time.elapsed;
    const season = getCurrentSeason(elapsed);

    if (season !== currentSeason) {
      const prev = currentSeason;
      currentSeason = season;
      eventBus.emit('season:changed', { season, previousSeason: prev });
    }
  };
}
