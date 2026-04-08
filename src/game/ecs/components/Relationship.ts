import { MAX_ENTITIES } from '@/core/Constants.js';

/** Maximum number of relationships any single entity can track. */
export const MAX_RELATIONSHIPS = 5;

const Relationship = {
  /** Target entity IDs. Indexed by: eid * MAX_RELATIONSHIPS + slot */
  target: new Float32Array(MAX_ENTITIES * MAX_RELATIONSHIPS),
  /** Sentiment value (-100 to 100). Indexed by: eid * MAX_RELATIONSHIPS + slot */
  value: new Float32Array(MAX_ENTITIES * MAX_RELATIONSHIPS),
  /**
   * Relationship type. Indexed by: eid * MAX_RELATIONSHIPS + slot
   * 0 = neutral, 1 = friend, 2 = enemy, 3 = romance, 4 = family
   */
  type: new Uint8Array(MAX_ENTITIES * MAX_RELATIONSHIPS),
  /** Number of active relationship slots per entity. */
  count: new Uint8Array(MAX_ENTITIES),
};

export default Relationship;
