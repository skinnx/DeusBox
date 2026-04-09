import { MAX_ENTITIES } from '@/core/Constants.js';

const SpriteRef = {
  textureKey: new Uint32Array(MAX_ENTITIES),
  /** Facing direction: 0=South, 1=West, 2=North, 3=East */
  direction: new Uint8Array(MAX_ENTITIES),
  /** Animation state: 0=idle, 1=walk, 2=attack, 3=die */
  animState: new Uint8Array(MAX_ENTITIES),
};

export default SpriteRef;
