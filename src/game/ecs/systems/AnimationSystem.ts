import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Velocity from '../components/Velocity.js';
import Health from '../components/Health.js';
import Combat from '../components/Combat.js';
import AnimationState from '../components/AnimationState.js';
import { Dead } from '../components/TagComponents.js';
import { ANIM_IDLE, ANIM_WALK, ANIM_ATTACK, ANIM_DIE, DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from '../components/AnimationState.js';

/** Velocity threshold to consider entity as walking (px/s) */
const WALK_VELOCITY_THRESHOLD = 5;
/** Attack animation duration (ms) */
const ATTACK_ANIM_DURATION = 400;
/** Death animation duration (ms) */
const DEATH_ANIM_DURATION = 800;
/** Walk animation frame interval (ms) */
const WALK_FRAME_INTERVAL = 200;

/**
 * Creates the AnimationSystem.
 * Determines animation state (idle/walk/attack/die) and facing direction
 * based on entity velocity, combat status, and health.
 */
export function createAnimationSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const entities = query(world, [Position, Velocity, AnimationState]);

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!;

      // ── Death animation (highest priority) ───────────────────────────
      if (hasComponent(world, eid, Dead) || Health.current[eid] <= 0) {
        if (AnimationState.state[eid] !== ANIM_DIE) {
          AnimationState.state[eid] = ANIM_DIE;
          AnimationState.frameTimer[eid] = 0;
          AnimationState.deathProgress[eid] = 0;
        }
        AnimationState.frameTimer[eid] += delta;
        AnimationState.deathProgress[eid] = Math.min(
          1,
          AnimationState.frameTimer[eid] / DEATH_ANIM_DURATION,
        );
        continue;
      }

      const vx = Velocity.x[eid];
      const vy = Velocity.y[eid];
      const speed = Math.sqrt(vx * vx + vy * vy);

      // ── Update direction from velocity ───────────────────────────────
      if (speed > WALK_VELOCITY_THRESHOLD) {
        // Use absolute angle to determine direction
        // Prioritize the axis with greater magnitude
        const absVx = Math.abs(vx);
        const absVy = Math.abs(vy);

        if (absVx > absVy) {
          AnimationState.direction[eid] = vx > 0 ? DIR_RIGHT : DIR_LEFT;
        } else {
          AnimationState.direction[eid] = vy > 0 ? DIR_DOWN : DIR_UP;
        }
      }

      // ── Attack animation ─────────────────────────────────────────────
      if (Combat.target[eid] >= 0 && speed < WALK_VELOCITY_THRESHOLD) {
        if (AnimationState.state[eid] !== ANIM_ATTACK) {
          AnimationState.state[eid] = ANIM_ATTACK;
          AnimationState.frameTimer[eid] = 0;
        }

        // Face toward combat target
        const targetEid = Combat.target[eid];
        if (hasComponent(world, targetEid, Position)) {
          const dx = Position.x[targetEid] - Position.x[eid];
          const dy = Position.y[targetEid] - Position.y[eid];
          if (Math.abs(dx) > Math.abs(dy)) {
            AnimationState.direction[eid] = dx > 0 ? DIR_RIGHT : DIR_LEFT;
          } else {
            AnimationState.direction[eid] = dy > 0 ? DIR_DOWN : DIR_UP;
          }
        }

        AnimationState.frameTimer[eid] += delta;
        // Return to idle after attack animation completes
        if (AnimationState.frameTimer[eid] >= ATTACK_ANIM_DURATION) {
          AnimationState.state[eid] = ANIM_IDLE;
          AnimationState.frameTimer[eid] = 0;
        }
        continue;
      }

      // ── Walk animation ───────────────────────────────────────────────
      if (speed > WALK_VELOCITY_THRESHOLD) {
        AnimationState.state[eid] = ANIM_WALK;
        AnimationState.frameTimer[eid] += delta;

        // Cycle walk frame
        if (AnimationState.frameTimer[eid] >= WALK_FRAME_INTERVAL) {
          AnimationState.frameTimer[eid] = 0;
          AnimationState.frame[eid] = (AnimationState.frame[eid] + 1) % 2;
        }
        continue;
      }

      // ── Idle (default) ───────────────────────────────────────────────
      AnimationState.state[eid] = ANIM_IDLE;
      AnimationState.frameTimer[eid] += delta;
      AnimationState.frame[eid] = 0;
    }
  };
}
