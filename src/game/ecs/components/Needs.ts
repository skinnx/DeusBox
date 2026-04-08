import { MAX_ENTITIES } from '@/core/Constants.js';

const Needs = {
  hunger: new Float32Array(MAX_ENTITIES),
  rest: new Float32Array(MAX_ENTITIES),
  social: new Float32Array(MAX_ENTITIES),
  fun: new Float32Array(MAX_ENTITIES),
};

export default Needs;
