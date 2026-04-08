import { MAX_ENTITIES } from '@/core/Constants.js';

const AIStateComponent = {
  state: new Float32Array(MAX_ENTITIES),
  target: new Float32Array(MAX_ENTITIES),
  job: new Float32Array(MAX_ENTITIES),
  timer: new Float32Array(MAX_ENTITIES),
};

export default AIStateComponent;
