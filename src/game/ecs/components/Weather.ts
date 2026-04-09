import { MAX_ENTITIES } from '@/core/Constants.js';

const Weather = {
  type: new Float32Array(MAX_ENTITIES),       // 0=clear, 1=rain, 2=storm, 3=fog, 4=snow
  intensity: new Float32Array(MAX_ENTITIES),  // 0-1
  windX: new Float32Array(MAX_ENTITIES),
  windY: new Float32Array(MAX_ENTITIES),
};

export default Weather;
