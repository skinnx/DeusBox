import { MAX_ENTITIES } from '@/core/Constants.js';

const MilitaryRole = {
  /** 0=none, 1=warrior, 2=archer, 3=mage */
  role: new Float32Array(MAX_ENTITIES),
  /** Rank 0-3 */
  rank: new Float32Array(MAX_ENTITIES),
  /** Formation offset X */
  formationX: new Float32Array(MAX_ENTITIES),
  /** Formation offset Y */
  formationY: new Float32Array(MAX_ENTITIES),
  /** Time spent in combat (ms) for rank progression */
  combatTime: new Float32Array(MAX_ENTITIES),
};

export default MilitaryRole;
