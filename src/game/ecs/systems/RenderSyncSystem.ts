import Phaser from 'phaser';
import { query, hasComponent, removeEntity } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import SpriteRef from '../components/SpriteRef.js';
import { Creature } from '../components/TagComponents.js';

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

  return (world: GameWorld): void => {
    const ents = query(world, [Position, SpriteRef]);

    // Update existing and detect new entities
    const currentEntities = new Set<number>();
    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];
      currentEntities.add(eid);

      let sprite = sprites.get(eid);
      if (!sprite) {
        // Create new sprite
        const textureKey = getTextureKeyFromHash(SpriteRef.textureKey[eid]);
        sprite = scene.add.sprite(Position.x[eid], Position.y[eid], textureKey);
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(eid);

        // Smaller sprites for creatures vs buildings
        if (hasComponent(world, eid, Creature)) {
          sprite.setScale(2);
        }

        sprites.set(eid, sprite);
      }

      // Sync position
      sprite.setPosition(Position.x[eid], Position.y[eid]);
    }

    // Remove sprites for entities that no longer exist
    for (const trackedEid of trackedEntities) {
      if (!currentEntities.has(trackedEid)) {
        const sprite = sprites.get(trackedEid);
        if (sprite) {
          sprite.destroy();
          sprites.delete(trackedEid);
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
