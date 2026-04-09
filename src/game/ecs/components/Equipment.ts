import { MAX_ENTITIES } from '@/core/Constants.js';

const Equipment = {
  /** 0=none, 1=sword, 2=bow, 3=staff */
  weapon: new Float32Array(MAX_ENTITIES),
  /** 0=none, 1=leather, 2=chain, 3=plate */
  armor: new Float32Array(MAX_ENTITIES),
  /** 0=none, 1=ring, 2=amulet */
  accessory: new Float32Array(MAX_ENTITIES),
};

export default Equipment;
