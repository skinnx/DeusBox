import { query } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Needs from '../components/Needs.js';
import AIStateComponent from '../components/AIState.js';
import { entityTypes } from '../factories/CreatureFactory.js';
import { getWeatherNeedsModifier } from './WeatherSystem.js';

/**
 * Interface matching creatures.json entries for needs decay rates.
 */
interface NeedsConfig {
  hungerDecay: number;
  restDecay: number;
  socialDecay: number;
  funDecay: number;
}

interface CreatureConfig {
  speed: number;
  maxHealth: number;
  color: string;
  needs: NeedsConfig;
  aiWeights: {
    food: number;
    rest: number;
    social: number;
    fun: number;
  };
}

// We cannot easily determine which creature type an entity is at runtime
// from components alone. Use a default decay rate that can be overridden
// by storing creature type → decay mapping.
import creatureData from '@/data/creatures.json';

const configs = creatureData as Record<string, CreatureConfig>;

/**
 * Get the average decay rates across all creature types as a default.
 * This is used when we don't know the specific creature type of an entity.
 */
function getDefaultDecay(): NeedsConfig {
  const types = Object.values(configs);
  const count = types.length;
  let hunger = 0,
    rest = 0,
    social = 0,
    fun = 0;
  for (const t of types) {
    hunger += t.needs.hungerDecay;
    rest += t.needs.restDecay;
    social += t.needs.socialDecay;
    fun += t.needs.funDecay;
  }
  return {
    hungerDecay: hunger / count,
    restDecay: rest / count,
    socialDecay: social / count,
    funDecay: fun / count,
  };
}

const defaultDecay = getDefaultDecay();

/**
 * Creates a needs decay system.
 * Increments hunger (gets hungrier), decrements rest/social/fun (get depleted).
 * All rates are per-second, read from creatures.json.
 */
export function createNeedsDecaySystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const hungerMod = getWeatherNeedsModifier('hunger');
    const restMod = getWeatherNeedsModifier('rest');
    const ents = query(world, [Needs, AIStateComponent]);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];

      // Look up per-creature-type decay rates, fall back to default average
      const creatureType = entityTypes.get(eid);
      const decay =
        creatureType && configs[creatureType] ? configs[creatureType].needs : defaultDecay;

      // Hunger increases (creature gets hungrier) — capped at 100
      Needs.hunger[eid] = Math.min(100, Needs.hunger[eid] + decay.hungerDecay * seconds * hungerMod);

      // Rest decreases (creature gets tired) — floored at 0
      Needs.rest[eid] = Math.max(0, Needs.rest[eid] - decay.restDecay * seconds * restMod);

      // Social decreases — floored at 0
      Needs.social[eid] = Math.max(0, Needs.social[eid] - decay.socialDecay * seconds);

      // Fun decreases — floored at 0
      Needs.fun[eid] = Math.max(0, Needs.fun[eid] - decay.funDecay * seconds);
    }
  };
}
