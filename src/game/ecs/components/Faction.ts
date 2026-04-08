import { MAX_ENTITIES } from '@/core/Constants.js';

const Faction = {
  id: new Float32Array(MAX_ENTITIES),
  reputation: new Float32Array(MAX_ENTITIES),
};

export default Faction;
