import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import AIStateComponent from '../components/AIState.js';
import Combat from '../components/Combat.js';
import MilitaryRole from '../components/MilitaryRole.js';
import Faction from '../components/Faction.js';
import { Dead } from '../components/TagComponents.js';
import { buildCreatureBehaviorTree } from '@/ai/NeedsAI.js';
import type { AIContext } from '@/ai/Actions.js';
import type { TileMap } from '@/world/TileMap.js';
import { AIState } from '@/core/Types.js';
import { getMilitaryRole, ROLE_WARRIOR, ROLE_ARCHER, ROLE_MAGE } from './MilitarySystem.js';
import { spatialHash } from './SpatialIndexSystem.js';

/** AI tick interval in milliseconds (~1 second) */
const AI_TICK_INTERVAL = 1000;

/** Military defend territory range */
const MILITARY_DEFEND_RANGE = 400;

/** Map of entity ID to its behavior tree instance */
const behaviorTrees = new Map<number, ReturnType<typeof buildCreatureBehaviorTree>>();

/**
 * Get or create a behavior tree for the given entity.
 */
function getBehaviorTree(eid: number): ReturnType<typeof buildCreatureBehaviorTree> {
  let tree = behaviorTrees.get(eid);
  if (!tree) {
    tree = buildCreatureBehaviorTree();
    behaviorTrees.set(eid, tree);
  }
  return tree;
}

/**
 * Creates the AI system that runs behavior trees for all entities with AIStateComponent.
 * Throttled: each entity's AI ticks every ~1 second.
 *
 * Military entities have priority behavior:
 * - Warriors: prioritize closest enemy
 * - Archers: maintain distance, attack from range
 * - Mages: target densest enemy cluster (AOE efficiency)
 * - All military: defend territory instead of fleeing
 */
export function createAISystem(tileMap: TileMap): (world: GameWorld, delta: number) => void {
  const context: AIContext = { world: null as unknown as GameWorld, tileMap };

  return (world: GameWorld, delta: number): void => {
    context.world = world;
    const ents = query(world, [Position, AIStateComponent]);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i]!;

      // Skip dead entities
      if (AIStateComponent.state[eid] === (AIState.Dead as unknown as number)) {
        continue;
      }

      // ── Military AI override ──────────────────────────────────────────
      if (hasComponent(world, eid, MilitaryRole)) {
        const role = getMilitaryRole(world, eid);
        if (role !== 0) {
          // Military entities defend territory: if enemy in range, switch to Fighting
          const myFaction = Faction.id[eid];
          const nearby = spatialHash.query(
            Position.x[eid],
            Position.y[eid],
            MILITARY_DEFEND_RANGE,
          );

          let bestTarget = -1;
          let bestDist = Infinity;

          if (role === ROLE_MAGE) {
            // Mage: find densest enemy cluster
            let bestClusterScore = -1;
            const enemyPositions: { eid: number; x: number; y: number }[] = [];

            for (let j = 0; j < nearby.length; j++) {
              const tEid = nearby[j]!;
              if (tEid === eid) continue;
              if (!hasComponent(world, tEid, Health)) continue;
              if (hasComponent(world, tEid, Dead)) continue;
              if (Faction.id[tEid] === myFaction) continue;
              enemyPositions.push({
                eid: tEid,
                x: Position.x[tEid],
                y: Position.y[tEid],
              });
            }

            // For each enemy, count neighbors within AOE radius
            for (const enemy of enemyPositions) {
              let clusterSize = 0;
              for (const other of enemyPositions) {
                const dx = enemy.x - other.x;
                const dy = enemy.y - other.y;
                if (dx * dx + dy * dy <= 48 * 48) clusterSize++;
              }
              if (clusterSize > bestClusterScore) {
                bestClusterScore = clusterSize;
                bestTarget = enemy.eid;
              }
            }
          } else if (role === ROLE_ARCHER) {
            // Archer: find furthest enemy within attack range preference
            // Prefer enemies that are NOT too close (maintain distance)
            for (let j = 0; j < nearby.length; j++) {
              const tEid = nearby[j]!;
              if (tEid === eid) continue;
              if (!hasComponent(world, tEid, Health)) continue;
              if (hasComponent(world, tEid, Dead)) continue;
              if (Faction.id[tEid] === myFaction) continue;

              const dx = Position.x[tEid] - Position.x[eid];
              const dy = Position.y[tEid] - Position.y[eid];
              const dist = Math.sqrt(dx * dx + dy * dy);

              // Archers prefer enemies at medium range (80-150px)
              if (dist >= 60 && dist <= 160 && dist < bestDist) {
                bestDist = dist;
                bestTarget = tEid;
              }
            }
            // Fallback: closest enemy
            if (bestTarget < 0) {
              for (let j = 0; j < nearby.length; j++) {
                const tEid = nearby[j]!;
                if (tEid === eid) continue;
                if (!hasComponent(world, tEid, Health)) continue;
                if (hasComponent(world, tEid, Dead)) continue;
                if (Faction.id[tEid] === myFaction) continue;

                const dx = Position.x[tEid] - Position.x[eid];
                const dy = Position.y[tEid] - Position.y[eid];
                const distSq = dx * dx + dy * dy;
                if (distSq < bestDist) {
                  bestDist = distSq;
                  bestTarget = tEid;
                }
              }
            }
          } else {
            // Warrior: closest enemy
            for (let j = 0; j < nearby.length; j++) {
              const tEid = nearby[j]!;
              if (tEid === eid) continue;
              if (!hasComponent(world, tEid, Health)) continue;
              if (hasComponent(world, tEid, Dead)) continue;
              if (Faction.id[tEid] === myFaction) continue;

              const dx = Position.x[tEid] - Position.x[eid];
              const dy = Position.y[tEid] - Position.y[eid];
              const distSq = dx * dx + dy * dy;
              if (distSq < bestDist) {
                bestDist = distSq;
                bestTarget = tEid;
              }
            }
          }

          if (bestTarget >= 0) {
            // Switch to Fighting state instead of fleeing
            AIStateComponent.state[eid] = AIState.Fighting as unknown as number;
            Combat.target[eid] = bestTarget;
          }
        }
      }

      // Throttle: accumulate time, only tick when interval exceeded
      AIStateComponent.timer[eid] += delta;
      if (AIStateComponent.timer[eid] < AI_TICK_INTERVAL) {
        continue;
      }
      AIStateComponent.timer[eid] = 0;

      // Tick the behavior tree
      const tree = getBehaviorTree(eid);
      tree.tick(eid, context);
    }
  };
}
