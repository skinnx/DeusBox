import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Faction from '../components/Faction.js';
import { Dead } from '../components/TagComponents.js';
import { TILE_SIZE } from '@/core/Constants.js';
import { getDiplomacyState, isAllied } from './DiplomacySystem.js';
import { DiplomacyState } from '@/core/Types.js';

/** Reputation boost per second when near same-faction or allied entities. */
const ALLY_REPUTATION_BOOST = 0.5;
/** Allied faction reputation boost per second. */
const DIPLOMACY_ALLY_BOOST = 1.0;
/** Reputation penalty per second when near different-faction (neutral) entities. */
const ENEMY_REPUTATION_PENALTY = 0.3;
/** War reputation decay per second. */
const WAR_REPUTATION_DECAY = 1.0;
/** Maximum reputation value. */
const MAX_REPUTATION = 100;
/** Minimum reputation value. */
const MIN_REPUTATION = 0;
/** Range to check for nearby faction entities. */
const FACTION_RANGE = TILE_SIZE * 6;

/**
 * Creates the faction system that tracks faction relationships.
 * Same-faction and allied creatures cooperate; different factions
 * may be hostile based on reputation and diplomacy state.
 */
export function createFactionSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const ents = query(world, [Position, Faction]);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];
      if (hasComponent(world, eid, Dead)) continue;

      const factionId = Faction.id[eid];
      const ex = Position.x[eid];
      const ey = Position.y[eid];

      for (let j = i + 1; j < ents.length; j++) {
        const otherEid = ents[j];
        if (hasComponent(world, otherEid, Dead)) continue;

        const otherFactionId = Faction.id[otherEid];
        const dx = Position.x[otherEid] - ex;
        const dy = Position.y[otherEid] - ey;
        const distSq = dx * dx + dy * dy;

        if (distSq < FACTION_RANGE * FACTION_RANGE) {
          if (otherFactionId === factionId) {
            // Same faction: boost reputation
            Faction.reputation[eid] = Math.min(
              MAX_REPUTATION,
              Faction.reputation[eid] + ALLY_REPUTATION_BOOST * seconds,
            );
            Faction.reputation[otherEid] = Math.min(
              MAX_REPUTATION,
              Faction.reputation[otherEid] + ALLY_REPUTATION_BOOST * seconds,
            );
          } else if (isAllied(factionId, otherFactionId)) {
            // Allied faction: treat like same faction (boost)
            Faction.reputation[eid] = Math.min(
              MAX_REPUTATION,
              Faction.reputation[eid] + DIPLOMACY_ALLY_BOOST * seconds,
            );
            Faction.reputation[otherEid] = Math.min(
              MAX_REPUTATION,
              Faction.reputation[otherEid] + DIPLOMACY_ALLY_BOOST * seconds,
            );
          } else {
            const dipState = getDiplomacyState(factionId, otherFactionId);
            if (dipState === DiplomacyState.AtWar) {
              // At war: fast reputation decay
              Faction.reputation[eid] = Math.max(
                MIN_REPUTATION,
                Faction.reputation[eid] - WAR_REPUTATION_DECAY * seconds,
              );
              Faction.reputation[otherEid] = Math.max(
                MIN_REPUTATION,
                Faction.reputation[otherEid] - WAR_REPUTATION_DECAY * seconds,
              );
            } else {
              // Neutral: standard hostility penalty
              Faction.reputation[eid] = Math.max(
                MIN_REPUTATION,
                Faction.reputation[eid] - ENEMY_REPUTATION_PENALTY * seconds,
              );
              Faction.reputation[otherEid] = Math.max(
                MIN_REPUTATION,
                Faction.reputation[otherEid] - ENEMY_REPUTATION_PENALTY * seconds,
              );
            }
          }
        }
      }
    }
  };
}
