import { MAX_ENTITIES } from '@/core/Constants.js';

const Health = {
  current: new Float32Array(MAX_ENTITIES),
  max: new Float32Array(MAX_ENTITIES),
};

export default Health;
