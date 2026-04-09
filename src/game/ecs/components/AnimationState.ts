import { MAX_ENTITIES } from '@/core/Constants.js';

/** Animation states */
export const ANIM_IDLE = 0;
export const ANIM_WALK = 1;
export const ANIM_ATTACK = 2;
export const ANIM_DIE = 3;

/** Direction values */
export const DIR_DOWN = 0;
export const DIR_LEFT = 1;
export const DIR_RIGHT = 2;
export const DIR_UP = 3;

/**
 * AnimationState component — tracks animation state and facing direction.
 * SoA pattern matching other DeusBox components.
 */
const AnimationState = {
  /** Current animation: 0=idle, 1=walk, 2=attack, 3=die */
  state: new Float32Array(MAX_ENTITIES),
  /** Facing direction: 0=down, 1=left, 2=right, 3=up */
  direction: new Float32Array(MAX_ENTITIES),
  /** Frame timer for animation cycling (ms) */
  frameTimer: new Float32Array(MAX_ENTITIES),
  /** Current frame index within animation */
  frame: new Float32Array(MAX_ENTITIES),
  /** Death animation progress (0-1) */
  deathProgress: new Float32Array(MAX_ENTITIES),
};

export default AnimationState;
