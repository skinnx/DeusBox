import { MAX_ENTITIES } from '@/core/Constants.js';

/**
 * SiegeState component tracks buildings under siege.
 * Attached to Structure entities when hostile military units are nearby.
 */
const SiegeState = {
  /** Whether the building is currently under siege (0/1) */
  active: new Float32Array(MAX_ENTITIES),
  /** Number of attackers currently besieging */
  attackerCount: new Float32Array(MAX_ENTITIES),
  /** Faction ID of the primary attacking force */
  attackerFaction: new Float32Array(MAX_ENTITIES),
  /** Accumulated siege damage (builds up over time) */
  siegeDamage: new Float32Array(MAX_ENTITIES),
  /** Time the siege has been active (ms) */
  siegeDuration: new Float32Array(MAX_ENTITIES),
};

export default SiegeState;
