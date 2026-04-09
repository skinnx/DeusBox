import Phaser from 'phaser';
import creatureData from '@/data/creatures.json';

/** Direction constants */
export const DIR_SOUTH = 0;
export const DIR_WEST = 1;
export const DIR_NORTH = 2;
export const DIR_EAST = 3;

/** Animation state constants */
export const ANIM_IDLE = 0;
export const ANIM_WALK = 1;
export const ANIM_ATTACK = 2;
export const ANIM_DIE = 3;

const DIR_KEYS = ['s', 'w', 'n', 'e'] as const;
const ANIM_KEYS = ['idle', 'walk', 'attack', 'die'] as const;

/**
 * Generates procedural sprite animation frames for all creature types.
 * Creates individual frame textures and Phaser animation clips.
 *
 * Frame naming: `creature_{type}_{dir}_{frame}` e.g. `creature_human_s_0`
 * Animation naming: `{anim}_{dir}_{type}` e.g. `idle_s_human`, `walk_w_orc`
 */
export class AnimationGenerator {
  /**
   * Generates all creature animation frames and animation clips.
   */
  static generateCreatureAnimations(scene: Phaser.Scene): void {
    const gfx = scene.add.graphics();
    const creatureTypes = Object.keys(creatureData);

    for (const type of creatureTypes) {
      const config = creatureData[type as keyof typeof creatureData];
      const color = Phaser.Display.Color.HexStringToColor(config.color).color;

      // Determine sprite dimensions
      const dims = getCreatureDimensions(type);

      // Generate frames for each direction x animation state
      for (let dir = 0; dir < 4; dir++) {
        for (let anim = 0; anim < 4; anim++) {
          const frameCount = getFrameCount(anim);
          for (let frame = 0; frame < frameCount; frame++) {
            gfx.clear();
            drawCreatureFrame(gfx, type, color, dims, dir, anim, frame);
            const frameKey = `creature_${type}_${DIR_KEYS[dir]}_${frame}_${ANIM_KEYS[anim]}`;
            gfx.generateTexture(frameKey, dims.w, dims.h);
          }
        }
      }

      // Create Phaser animation clips
      for (let dir = 0; dir < 4; dir++) {
        for (let anim = 0; anim < 4; anim++) {
          createAnimationClip(scene, type, dir, anim);
        }
      }
    }

    gfx.destroy();
  }
}

/** Get sprite dimensions for creature type */
function getCreatureDimensions(type: string): { w: number; h: number } {
  switch (type) {
    case 'wolf': return { w: 12, h: 8 };
    case 'deer': return { w: 10, h: 10 };
    case 'chicken': return { w: 6, h: 6 };
    case 'bear': return { w: 14, h: 10 };
    case 'fish': return { w: 8, h: 4 };
    case 'orc': return { w: 10, h: 12 };
    default: return { w: 8, h: 12 }; // human, elf, dwarf
  }
}

/** Get number of frames for an animation state */
function getFrameCount(anim: number): number {
  switch (anim) {
    case ANIM_IDLE: return 1;
    case ANIM_WALK: return 4;
    case ANIM_ATTACK: return 2;
    case ANIM_DIE: return 2;
    default: return 1;
  }
}

/** Get animation FPS for state */
function getAnimFPS(anim: number): number {
  switch (anim) {
    case ANIM_IDLE: return 4;
    case ANIM_WALK: return 8;
    case ANIM_ATTACK: return 12;
    case ANIM_DIE: return 6;
    default: return 4;
  }
}

/** Whether animation should repeat */
function shouldRepeat(anim: number): number {
  return anim === ANIM_DIE || anim === ANIM_ATTACK ? 0 : -1;
}

/** Create a Phaser animation clip */
function createAnimationClip(
  scene: Phaser.Scene,
  type: string,
  dir: number,
  anim: number,
): void {
  const animKey = `${ANIM_KEYS[anim]}_${DIR_KEYS[dir]}_${type}`;
  const frameCount = getFrameCount(anim);
  const frames: string[] = [];

  for (let f = 0; f < frameCount; f++) {
    frames.push(`creature_${type}_${DIR_KEYS[dir]}_${f}_${ANIM_KEYS[anim]}`);
  }

  // Skip if animation already exists (prevents duplicates on scene restart)
  if (scene.anims.exists(animKey)) return;

  scene.anims.create({
    key: animKey,
    frames: frames.map(f => ({ key: f })),
    frameRate: getAnimFPS(anim),
    repeat: shouldRepeat(anim),
  });
}

// ── Frame drawing functions ──────────────────────────────────────────

function drawCreatureFrame(
  gfx: Phaser.GameObjects.Graphics,
  type: string,
  color: number,
  dims: { w: number; h: number },
  dir: number,
  anim: number,
  frame: number,
): void {
  // Draw base creature based on type
  if (type === 'wolf') drawWolfFrame(gfx, color, dir, anim, frame);
  else if (type === 'deer') drawDeerFrame(gfx, color, dir, anim, frame);
  else if (type === 'chicken') drawChickenFrame(gfx, color, dir, anim, frame);
  else if (type === 'bear') drawBearFrame(gfx, color, dir, anim, frame);
  else if (type === 'fish') drawFishFrame(gfx, color, dir, anim, frame);
  else if (type === 'orc') drawOrcFrame(gfx, color, dir, anim, frame);
  else drawHumanoidFrame(gfx, color, dims, dir, anim, frame);
}

/** Walk leg offset based on frame */
function walkLegOffset(frame: number): number {
  // Frames: 0=neutral, 1=left forward, 2=neutral, 3=right forward
  if (frame === 1) return -1;
  if (frame === 3) return 1;
  return 0;
}

/** Attack arm extension */
function attackArmOffset(frame: number): number {
  return frame === 0 ? 0 : 2;
}

// ── Humanoid frame drawing ──────────────────────────────────────────

function drawHumanoidFrame(
  gfx: Phaser.GameObjects.Graphics,
  color: number,
  dims: { w: number; h: number },
  dir: number,
  anim: number,
  frame: number,
): void {
  if (anim === ANIM_DIE) {
    // Death: body fallen (compressed vertically, shifted down)
    const fallShift = frame === 0 ? 0 : 3;
    gfx.fillStyle(color);
    gfx.fillRect(1, 6 + fallShift, 6, 3);
    gfx.fillStyle(0x333333);
    gfx.fillRect(1, 9 + fallShift, 2, 2);
    gfx.fillRect(5, 9 + fallShift, 2, 2);
    // Head tilted
    gfx.fillStyle(color);
    gfx.fillRect(2, 4 + fallShift, 3, 2);
    return;
  }

  const legOff = anim === ANIM_WALK ? walkLegOffset(frame) : 0;
  const armOff = anim === ANIM_ATTACK ? attackArmOffset(frame) : 0;

  // Head (3x3)
  gfx.fillStyle(color);
  if (dir === DIR_NORTH) {
    // Back view — no eyes
    gfx.fillRect(3, 0, 3, 3);
  } else {
    gfx.fillRect(3, 0, 3, 3);
    // Eyes
    gfx.fillStyle(0x000000);
    if (dir === DIR_SOUTH) {
      gfx.fillRect(3, 1, 1, 1);
      gfx.fillRect(5, 1, 1, 1);
    } else if (dir === DIR_WEST) {
      gfx.fillRect(3, 1, 1, 1);
    } else {
      // East
      gfx.fillRect(5, 1, 1, 1);
    }
  }

  // Body (4x4)
  gfx.fillStyle(color);
  gfx.fillRect(2, 3, 4, 4);

  // Legs with walk offset
  gfx.fillStyle(0x333333);
  gfx.fillRect(2, 7 + legOff, 2, 4);
  gfx.fillRect(5, 7 - legOff, 2, 4);

  // Arms with attack offset
  gfx.fillStyle(color);
  if (dir === DIR_EAST) {
    gfx.fillRect(1, 4, 1, 3);
    gfx.fillRect(6 + armOff, 4, 1 + armOff, 3);
  } else if (dir === DIR_WEST) {
    gfx.fillRect(1 - armOff, 4, 1 + armOff, 3);
    gfx.fillRect(6, 4, 1, 3);
  } else {
    // South/North — arms on sides
    gfx.fillRect(1, 4, 1, 3);
    gfx.fillRect(6, 4, 1, 3);
    if (armOff > 0) {
      // Attack forward arm extension
      gfx.fillRect(3, 6, 2, 1 + armOff);
    }
  }
}

// ── Orc frame drawing ───────────────────────────────────────────────

function drawOrcFrame(
  gfx: Phaser.GameObjects.Graphics,
  color: number,
  dir: number,
  anim: number,
  frame: number,
): void {
  if (anim === ANIM_DIE) {
    const fallShift = frame === 0 ? 0 : 4;
    gfx.fillStyle(color);
    gfx.fillRect(1, 7 + fallShift, 8, 3);
    gfx.fillStyle(0x333333);
    gfx.fillRect(1, 10 + fallShift, 2, 2);
    gfx.fillRect(7, 10 + fallShift, 2, 2);
    gfx.fillStyle(color);
    gfx.fillRect(3, 5 + fallShift, 4, 2);
    return;
  }

  const legOff = anim === ANIM_WALK ? walkLegOffset(frame) : 0;
  const armOff = anim === ANIM_ATTACK ? attackArmOffset(frame) : 0;

  // Head (4x3)
  gfx.fillStyle(color);
  gfx.fillRect(3, 0, 4, 3);

  // Eyes
  if (dir !== DIR_NORTH) {
    gfx.fillStyle(0x000000);
    if (dir === DIR_SOUTH) {
      gfx.fillRect(3, 1, 1, 1);
      gfx.fillRect(6, 1, 1, 1);
    } else if (dir === DIR_WEST) {
      gfx.fillRect(3, 1, 1, 1);
    } else {
      gfx.fillRect(6, 1, 1, 1);
    }

    // Tusks
    gfx.fillStyle(0xffffff);
    if (dir === DIR_SOUTH) {
      gfx.fillRect(3, 3, 1, 1);
      gfx.fillRect(6, 3, 1, 1);
    } else if (dir === DIR_WEST) {
      gfx.fillRect(3, 3, 1, 1);
    } else {
      gfx.fillRect(6, 3, 1, 1);
    }
  }

  // Body
  gfx.fillStyle(color);
  gfx.fillRect(2, 4, 6, 3);

  // Legs
  gfx.fillStyle(0x333333);
  gfx.fillRect(2, 7 + legOff, 2, 5);
  gfx.fillRect(6, 7 - legOff, 2, 5);

  // Arms
  gfx.fillStyle(color);
  gfx.fillRect(1, 4, 1, 3);
  gfx.fillRect(8 + armOff, 4, 1 + armOff, 3);
}

// ── Animal frame drawing ────────────────────────────────────────────

function drawWolfFrame(
  gfx: Phaser.GameObjects.Graphics,
  color: number,
  dir: number,
  anim: number,
  frame: number,
): void {
  if (anim === ANIM_DIE) {
    gfx.fillStyle(color);
    gfx.fillRect(1, 5, 10, 2);
    return;
  }

  const legOff = anim === ANIM_WALK ? walkLegOffset(frame) : 0;

  // Body
  gfx.fillStyle(color);
  gfx.fillRect(2, 3, 8, 3);

  // Head
  gfx.fillStyle(color);
  const headX = dir === DIR_EAST ? 9 : 0;
  gfx.fillRect(headX, 2, 3, 3);

  // Eye
  gfx.fillStyle(0xff0000);
  gfx.fillRect(headX + (dir === DIR_EAST ? 1 : 1), 3, 1, 1);

  // Legs
  gfx.fillStyle(0x444444);
  gfx.fillRect(2, 6 + legOff, 1, 2);
  gfx.fillRect(4, 6 - legOff, 1, 2);
  gfx.fillRect(7, 6 + legOff, 1, 2);
  gfx.fillRect(9, 6 - legOff, 1, 2);

  // Tail
  gfx.fillStyle(color);
  const tailX = dir === DIR_EAST ? 0 : 10;
  gfx.fillRect(tailX, 2, 2, 1);
}

function drawDeerFrame(
  gfx: Phaser.GameObjects.Graphics,
  color: number,
  dir: number,
  anim: number,
  frame: number,
): void {
  if (anim === ANIM_DIE) {
    gfx.fillStyle(color);
    gfx.fillRect(1, 7, 8, 2);
    return;
  }

  const legOff = anim === ANIM_WALK ? walkLegOffset(frame) : 0;

  gfx.fillStyle(color);
  gfx.fillRect(2, 4, 6, 3);
  gfx.fillRect(0, 3, 2, 3);

  gfx.fillStyle(0x000000);
  gfx.fillRect(0, 4, 1, 1);

  gfx.fillStyle(0x8b4513);
  gfx.fillRect(0, 1, 1, 2);
  gfx.fillRect(2, 1, 1, 2);

  gfx.fillStyle(0x5d4e37);
  gfx.fillRect(2, 7 + legOff, 1, 3);
  gfx.fillRect(4, 7 - legOff, 1, 3);
  gfx.fillRect(6, 7 + legOff, 1, 3);
  gfx.fillRect(8, 7 - legOff, 1, 3);
}

function drawChickenFrame(
  gfx: Phaser.GameObjects.Graphics,
  color: number,
  dir: number,
  anim: number,
  frame: number,
): void {
  if (anim === ANIM_DIE) {
    gfx.fillStyle(color);
    gfx.fillRect(1, 4, 4, 2);
    return;
  }

  const legOff = anim === ANIM_WALK ? walkLegOffset(frame) : 0;

  gfx.fillStyle(color);
  gfx.fillRect(1, 2, 4, 3);
  gfx.fillRect(0, 0, 2, 2);

  gfx.fillStyle(0xff8800);
  gfx.fillRect(0, 1, 1, 1);

  gfx.fillStyle(0x000000);
  gfx.fillRect(1, 0, 1, 1);

  gfx.fillStyle(0xff8800);
  gfx.fillRect(2, 5 + legOff, 1, 1);
  gfx.fillRect(4, 5 - legOff, 1, 1);
}

function drawBearFrame(
  gfx: Phaser.GameObjects.Graphics,
  color: number,
  dir: number,
  anim: number,
  frame: number,
): void {
  if (anim === ANIM_DIE) {
    gfx.fillStyle(color);
    gfx.fillRect(0, 7, 14, 3);
    return;
  }

  const legOff = anim === ANIM_WALK ? walkLegOffset(frame) : 0;
  const armOff = anim === ANIM_ATTACK ? attackArmOffset(frame) : 0;

  gfx.fillStyle(color);
  gfx.fillRect(2, 3, 10, 4);
  gfx.fillRect(0, 2, 3, 3);
  gfx.fillRect(0, 1, 1, 1);
  gfx.fillRect(2, 1, 1, 1);

  if (dir !== DIR_NORTH) {
    gfx.fillStyle(0x000000);
    gfx.fillRect(0, 3, 1, 1);
    gfx.fillRect(2, 3, 1, 1);
    gfx.fillStyle(0x8b7355);
    gfx.fillRect(1, 3, 1, 1);
  }

  gfx.fillStyle(0x3d2e1f);
  gfx.fillRect(2, 7 + legOff, 2, 3);
  gfx.fillRect(5, 7 - legOff, 2, 3);
  gfx.fillRect(8, 7 + legOff, 2, 3);
  gfx.fillRect(11, 7 - legOff, 2, 3);

  gfx.fillStyle(color);
  gfx.fillRect(12, 3, 1, 1);

  if (armOff > 0) {
    gfx.fillStyle(0x3d2e1f);
    gfx.fillRect(0, 5, 2 + armOff, 2);
  }
}

function drawFishFrame(
  gfx: Phaser.GameObjects.Graphics,
  color: number,
  dir: number,
  anim: number,
  frame: number,
): void {
  // Fish don't walk/attack — simple bob for walk (swim), flip for die
  const bobOff = anim === ANIM_WALK ? (frame % 2 === 0 ? 0 : 1) : 0;

  gfx.fillStyle(color);
  gfx.fillRect(1, 1 + bobOff, 6, 2);
  gfx.fillRect(0, 1 + bobOff, 1, 2);

  if (anim === ANIM_DIE) {
    // Flip upside down
    gfx.clear();
    gfx.fillStyle(color);
    gfx.fillRect(1, 1, 6, 2);
    gfx.fillRect(7, 2, 1, 1);
    gfx.fillRect(7, 0, 1, 1);
    gfx.fillStyle(0x000000);
    gfx.fillRect(1, 2, 1, 1); // X eye
    return;
  }

  gfx.fillStyle(color);
  gfx.fillRect(7, 0, 1, 1);
  gfx.fillRect(7, 3, 1, 1);

  gfx.fillStyle(0x000000);
  gfx.fillRect(1, 1 + bobOff, 1, 1);

  gfx.fillStyle(0x5dade2);
  gfx.fillRect(2, 2 + bobOff, 3, 1);
}
