import Phaser from 'phaser';
import { query, hasComponent, removeEntity } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import SpriteRef from '../components/SpriteRef.js';
import MilitaryRole from '../components/MilitaryRole.js';
import Equipment from '../components/Equipment.js';
import AnimationState from '../components/AnimationState.js';
import { Creature } from '../components/TagComponents.js';
import { ANIM_IDLE, ANIM_WALK, ANIM_ATTACK, ANIM_DIE, DIR_LEFT, DIR_RIGHT, DIR_UP, DIR_DOWN } from '../components/AnimationState.js';
import { ROLE_WARRIOR, ROLE_ARCHER, ROLE_MAGE } from './MilitarySystem.js';

/**
 * Creates a render sync system that keeps Phaser sprites in sync with
 * ECS Position data. Creates sprites for new entities, updates positions,
 * and destroys sprites for removed entities.
 */
export function createRenderSyncSystem(
  scene: Phaser.Scene,
  sprites: Map<number, Phaser.GameObjects.Sprite>,
): (world: GameWorld, delta: number) => void {
  const trackedEntities = new Set<number>();
  /** Equipment overlay sprites keyed by entity ID */
  const equipOverlays = new Map<number, Phaser.GameObjects.Sprite[]>();

  return (world: GameWorld): void => {
    const ents = query(world, [Position, SpriteRef]);

    // Update existing and detect new entities
    const currentEntities = new Set<number>();
    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i]!;
      currentEntities.add(eid);

      let sprite = sprites.get(eid);
      if (!sprite) {
        // Determine texture key — use military variant if applicable
        let textureKey = getTextureKeyFromHash(SpriteRef.textureKey[eid]);

        if (hasComponent(world, eid, MilitaryRole)) {
          const role = MilitaryRole.role[eid];
          const roleSuffix = role === ROLE_WARRIOR ? '_warrior'
            : role === ROLE_ARCHER ? '_archer'
            : role === ROLE_MAGE ? '_mage'
            : null;

          if (roleSuffix) {
            const variantKey = textureKey + roleSuffix;
            // Check if the variant texture exists
            if (scene.textures.exists(variantKey)) {
              textureKey = variantKey;
            }
          }
        }

        sprite = scene.add.sprite(Position.x[eid], Position.y[eid], textureKey);
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(eid);

        // Smaller sprites for creatures vs buildings
        if (hasComponent(world, eid, Creature)) {
          sprite.setScale(2);
        }

        sprites.set(eid, sprite);
      } else {
        // Update texture if military role changed
        if (hasComponent(world, eid, MilitaryRole)) {
          const role = MilitaryRole.role[eid];
          const baseKey = getTextureKeyFromHash(SpriteRef.textureKey[eid]);
          const roleSuffix = role === ROLE_WARRIOR ? '_warrior'
            : role === ROLE_ARCHER ? '_archer'
            : role === ROLE_MAGE ? '_mage'
            : null;

          const desiredKey = roleSuffix && scene.textures.exists(baseKey + roleSuffix)
            ? baseKey + roleSuffix
            : baseKey;

          if (sprite.texture.key !== desiredKey) {
            sprite.setTexture(desiredKey);
          }
        }
      }

      // Sync position
      sprite.setPosition(Position.x[eid], Position.y[eid]);

      // ── Animation visual updates ────────────────────────────────────
      if (hasComponent(world, eid, AnimationState)) {
        const animState = AnimationState.state[eid];
        const direction = AnimationState.direction[eid];
        const baseScale = hasComponent(world, eid, Creature) ? 2 : 1;

        // Direction: flip sprite horizontally for left-facing
        if (direction === DIR_LEFT) {
          sprite.setFlipX(true);
        } else {
          sprite.setFlipX(false);
        }

        // Death animation: fade out
        if (animState === ANIM_DIE) {
          const progress = AnimationState.deathProgress[eid];
          sprite.setAlpha(1 - progress);
          sprite.setScale(baseScale * (1 - progress * 0.3));
        }
        // Attack animation: scale pulse
        else if (animState === ANIM_ATTACK) {
          const t = AnimationState.frameTimer[eid] / 400; // ATTACK_ANIM_DURATION
          const pulse = 1 + Math.sin(t * Math.PI) * 0.15;
          sprite.setScale(baseScale * pulse);
          sprite.setAlpha(1);
        }
        // Walk animation: bob effect
        else if (animState === ANIM_WALK) {
          const frame = AnimationState.frame[eid];
          const bob = frame === 0 ? 0 : -1;
          sprite.setPosition(Position.x[eid], Position.y[eid] + bob);
          sprite.setScale(baseScale);
          sprite.setAlpha(1);
        }
        // Idle
        else {
          sprite.setScale(baseScale);
          sprite.setAlpha(1);
        }
      }

      // Equipment overlay rendering
      if (hasComponent(world, eid, Equipment)) {
        const weapon = Equipment.weapon[eid];
        const armor = Equipment.armor[eid];

        // Build list of desired overlay texture keys
        const desiredTextures: string[] = [];
        if (armor === 1) desiredTextures.push('armor_leather');
        else if (armor === 2) desiredTextures.push('armor_chain');
        else if (armor === 3) desiredTextures.push('armor_plate');

        if (weapon === 1) desiredTextures.push('equip_sword');
        else if (weapon === 2) desiredTextures.push('equip_bow');
        else if (weapon === 3) desiredTextures.push('equip_staff');

        // Check if overlays need updating
        const currentOverlays = equipOverlays.get(eid);
        const needsUpdate = !currentOverlays
          || currentOverlays.length !== desiredTextures.length
          || currentOverlays.some((s, idx) => s.texture.key !== desiredTextures[idx]);

        if (needsUpdate) {
          // Remove old overlays
          if (currentOverlays) {
            for (const overlay of currentOverlays) overlay.destroy();
          }

          // Create new overlays
          const newOverlays: Phaser.GameObjects.Sprite[] = [];
          for (const tex of desiredTextures) {
            if (scene.textures.exists(tex)) {
              const overlay = scene.add.sprite(Position.x[eid], Position.y[eid], tex);
              overlay.setOrigin(0.5, 0.5);
              overlay.setDepth(eid + 0.5);
              overlay.setScale(sprite.scaleX);
              newOverlays.push(overlay);
            }
          }
          equipOverlays.set(eid, newOverlays);
        } else if (currentOverlays) {
          // Sync overlay positions
          for (const overlay of currentOverlays) {
            overlay.setPosition(Position.x[eid], Position.y[eid]);
          }
        }
      }
    }

    // Remove sprites for entities that no longer exist
    for (const trackedEid of trackedEntities) {
      if (!currentEntities.has(trackedEid)) {
        const sprite = sprites.get(trackedEid);
        if (sprite) {
          sprite.destroy();
          sprites.delete(trackedEid);
        }
        // Clean up equipment overlays
        const overlays = equipOverlays.get(trackedEid);
        if (overlays) {
          for (const overlay of overlays) overlay.destroy();
          equipOverlays.delete(trackedEid);
        }
      }
    }

    trackedEntities.clear();
    for (const eid of currentEntities) {
      trackedEntities.add(eid);
    }
  };
}

/**
 * Simple hash-to-string lookup for texture keys.
 * We store a bidirectional map to convert between string keys and numeric hashes.
 */
const textureKeyMap = new Map<number, string>();
let nextTextureHash = 1;

export function hashTextureKey(key: string): number {
  for (const [hash, name] of textureKeyMap) {
    if (name === key) return hash;
  }
  const hash = nextTextureHash++;
  textureKeyMap.set(hash, key);
  return hash;
}

function getTextureKeyFromHash(hash: number): string {
  return textureKeyMap.get(hash) ?? '__white';
}

/**
 * Call before entity removal to clean up the sprite.
 */
export function destroyEntitySprite(
  world: GameWorld,
  sprites: Map<number, Phaser.GameObjects.Sprite>,
  eid: number,
): void {
  const sprite = sprites.get(eid);
  if (sprite) {
    sprite.destroy();
    sprites.delete(eid);
  }
  removeEntity(world, eid);
}
