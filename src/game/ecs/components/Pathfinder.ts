import { MAX_ENTITIES } from '@/core/Constants.js';

const Pathfinder = {
  targetX: new Float32Array(MAX_ENTITIES),
  targetY: new Float32Array(MAX_ENTITIES),
  pathIndex: new Float32Array(MAX_ENTITIES),
  speed: new Float32Array(MAX_ENTITIES),
};

export default Pathfinder;
