import type { GameWorld } from '@/game/ecs/ECSHost.js';
import type { TileMap } from '@/world/TileMap.js';
import { hasComponent, query as bitecsQuery } from 'bitecs';
import { NodeStatus } from '@/ai/NodeStatus.js';
import { AIState } from '@/core/Types.js';
import { TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from '@/core/Constants.js';
import Position from '@/game/ecs/components/Position.js';
import Velocity from '@/game/ecs/components/Velocity.js';
import Needs from '@/game/ecs/components/Needs.js';
import AIStateComponent from '@/game/ecs/components/AIState.js';
import Pathfinder from '@/game/ecs/components/Pathfinder.js';
import Health from '@/game/ecs/components/Health.js';
import Inventory from '@/game/ecs/components/Inventory.js';
import MarketInventory from '@/game/ecs/components/MarketInventory.js';
import Structure from '@/game/ecs/components/Structure.js';
import { Humanoid } from '@/game/ecs/components/TagComponents.js';
import { TileType } from '@/core/Types.js';
import { findPath } from '@/utils/Pathfinding.js';

/**
 * Shared context object passed through the behavior tree.
 * Set once per frame by the AISystem.
 */
export interface AIContext {
  world: GameWorld;
  tileMap: TileMap;
}

/** Food-yielding tile types */
const FOOD_TILES: ReadonlySet<TileType> = new Set([
  TileType.Grass,
  TileType.Forest,
  TileType.DenseForest,
]);

/**
 * Wander: pick a random nearby target and move toward it.
 */
export function wanderAction(eid: number, ctx: unknown): NodeStatus {
  const context = ctx as AIContext;
  const px = Position.x[eid];
  const py = Position.y[eid];

  // If we already have a valid wander target, keep going
  const tx = Pathfinder.targetX[eid];
  const ty = Pathfinder.targetY[eid];
  const dx = tx - px;
  const dy = ty - py;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 4) {
    // Still moving toward target
    AIStateComponent.state[eid] = AIState.Wandering as unknown as number;
    return NodeStatus.Running;
  }

  // Pick a new random target within 3-8 tiles
  const tileRange = 3 + Math.random() * 5;
  const angle = Math.random() * Math.PI * 2;
  let newTx = px + Math.cos(angle) * tileRange * TILE_SIZE;
  let newTy = py + Math.sin(angle) * tileRange * TILE_SIZE;

  // Clamp to world bounds
  const worldW = WORLD_TILES_X * TILE_SIZE;
  const worldH = WORLD_TILES_Y * TILE_SIZE;
  newTx = Math.max(TILE_SIZE, Math.min(worldW - TILE_SIZE, newTx));
  newTy = Math.max(TILE_SIZE, Math.min(worldH - TILE_SIZE, newTy));

  Pathfinder.targetX[eid] = newTx;
  Pathfinder.targetY[eid] = newTy;
  Pathfinder.pathIndex[eid] = 0;
  AIStateComponent.state[eid] = AIState.Wandering as unknown as number;

  setVelocityToward(eid, px, py, newTx, newTy);
  return NodeStatus.Running;
}

/**
 * Seek food: find the nearest grass/forest tile and set as target.
 */
export function seekFoodAction(eid: number, ctx: unknown): NodeStatus {
  const context = ctx as AIContext;
  const px = Position.x[eid];
  const py = Position.y[eid];
  const tileX = Math.floor(px / TILE_SIZE);
  const tileY = Math.floor(py / TILE_SIZE);

  // Check if already on a food tile
  const currentTile = context.tileMap.getTile(tileX, tileY);
  if (FOOD_TILES.has(currentTile)) {
    // Already at food — eat
    Velocity.x[eid] = 0;
    Velocity.y[eid] = 0;
    return NodeStatus.Success;
  }

  // Check if already moving toward food
  const currentTargetTile = context.tileMap.getTile(
    Math.floor(Pathfinder.targetX[eid] / TILE_SIZE),
    Math.floor(Pathfinder.targetY[eid] / TILE_SIZE),
  );
  if (FOOD_TILES.has(currentTargetTile)) {
    const dx = Pathfinder.targetX[eid] - px;
    const dy = Pathfinder.targetY[eid] - py;
    if (Math.sqrt(dx * dx + dy * dy) > 4) {
      AIStateComponent.state[eid] = AIState.Seeking as unknown as number;
      return NodeStatus.Running;
    }
    return NodeStatus.Success;
  }

  // Spiral search for nearest food tile
  const searchRadius = 20;
  let bestDist = Infinity;
  let bestX = -1;
  let bestY = -1;

  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const nx = tileX + dx;
      const ny = tileY + dy;
      if (!context.tileMap.isInBounds(nx, ny)) continue;
      const tile = context.tileMap.getTile(nx, ny);
      if (FOOD_TILES.has(tile)) {
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestX = nx;
          bestY = ny;
        }
      }
    }
  }

  if (bestX >= 0) {
    const targetPx = bestX * TILE_SIZE + TILE_SIZE / 2;
    const targetPy = bestY * TILE_SIZE + TILE_SIZE / 2;
    Pathfinder.targetX[eid] = targetPx;
    Pathfinder.targetY[eid] = targetPy;
    Pathfinder.pathIndex[eid] = 0;
    AIStateComponent.state[eid] = AIState.Seeking as unknown as number;
    setVelocityToward(eid, px, py, targetPx, targetPy);
    return NodeStatus.Running;
  }

  return NodeStatus.Failure;
}

/**
 * Eat: if on a food tile, reduce hunger.
 */
export function eatAction(eid: number, _ctx: unknown): NodeStatus {
  const hunger = Needs.hunger[eid];
  if (hunger <= 0) {
    return NodeStatus.Success;
  }

  AIStateComponent.state[eid] = AIState.Eating as unknown as number;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;

  // Reduce hunger (eating makes it go down — lower is less hungry)
  Needs.hunger[eid] = Math.max(0, hunger - 30);
  return NodeStatus.Success;
}

/**
 * Rest: stop moving, increase rest need value (higher = more rested).
 */
export function restAction(eid: number, _ctx: unknown): NodeStatus {
  AIStateComponent.state[eid] = AIState.Resting as unknown as number;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;

  // Increase rest (toward 100 = fully rested)
  const rest = Needs.rest[eid];
  Needs.rest[eid] = Math.min(100, rest + 25);
  return NodeStatus.Success;
}

/**
 * Socialize: find a nearby entity of the same faction and approach it.
 */
export function socializeAction(eid: number, ctx: unknown): NodeStatus {
  const context = ctx as AIContext;
  AIStateComponent.state[eid] = AIState.Socializing as unknown as number;

  // Check if we have a target entity (stored in AIStateComponent.target)
  const targetEid = AIStateComponent.target[eid];
  if (targetEid > 0) {
    const dx = Position.x[targetEid] - Position.x[eid];
    const dy = Position.y[targetEid] - Position.y[eid];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 40) {
      // Close enough to socialize
      Velocity.x[eid] = 0;
      Velocity.y[eid] = 0;
      Needs.social[eid] = Math.min(100, Needs.social[eid] + 20);
      AIStateComponent.target[eid] = 0;
      return NodeStatus.Success;
    }

    // Move toward target entity
    setVelocityToward(
      eid,
      Position.x[eid],
      Position.y[eid],
      Position.x[targetEid],
      Position.y[targetEid],
    );
    return NodeStatus.Running;
  }

  // Find nearby entity of same faction (simple approach: check stored positions)
  // Reset target
  AIStateComponent.target[eid] = 0;
  return NodeStatus.Success;
}

/**
 * Flee: if health < 30%, move away from current position (opposite direction of threat).
 */
export function fleeAction(eid: number, _ctx: unknown): NodeStatus {
  const health = Health.current[eid];
  const maxHealth = Health.max[eid];

  if (health / maxHealth > 0.3) {
    return NodeStatus.Success; // No longer in danger
  }

  AIStateComponent.state[eid] = AIState.Fleeing as unknown as number;

  // Move away from current target area — pick a direction and run
  const tx = Pathfinder.targetX[eid];
  const ty = Pathfinder.targetY[eid];
  const px = Position.x[eid];
  const py = Position.y[eid];

  // Check if we're already fleeing somewhere
  const dx = tx - px;
  const dy = ty - py;
  if (Math.sqrt(dx * dx + dy * dy) > 4) {
    return NodeStatus.Running;
  }

  // Pick a random direction to flee (faster speed)
  const angle = Math.random() * Math.PI * 2;
  const fleeDist = 8 * TILE_SIZE;
  const worldW = WORLD_TILES_X * TILE_SIZE;
  const worldH = WORLD_TILES_Y * TILE_SIZE;
  const newTx = Math.max(TILE_SIZE, Math.min(worldW - TILE_SIZE, px + Math.cos(angle) * fleeDist));
  const newTy = Math.max(TILE_SIZE, Math.min(worldH - TILE_SIZE, py + Math.sin(angle) * fleeDist));

  Pathfinder.targetX[eid] = newTx;
  Pathfinder.targetY[eid] = newTy;
  Pathfinder.pathIndex[eid] = 0;

  setVelocityToward(eid, px, py, newTx, newTy);
  return NodeStatus.Running;
}

/**
 * Trade action: if inventory is full, pathfind to nearest marketplace.
 * The actual trade happens in TradeSystem when near the marketplace.
 */
export function tradeAction(eid: number, ctx: unknown): NodeStatus {
  const context = ctx as AIContext;
  if (!hasComponent(context.world, eid, Inventory)) return NodeStatus.Failure;

  const px = Position.x[eid];
  const py = Position.y[eid];

  // Check if near a marketplace (within trade range) — trade happens via TradeSystem
  const markets = queryMarkets(context.world);
  for (const marketEid of markets) {
    const dx = Position.x[marketEid] - px;
    const dy = Position.y[marketEid] - py;
    if (dx * dx + dy * dy < (TILE_SIZE * 4) * (TILE_SIZE * 4)) {
      // At marketplace — TradeSystem handles the actual trade
      Velocity.x[eid] = 0;
      Velocity.y[eid] = 0;
      AIStateComponent.state[eid] = AIState.Working as unknown as number;
      return NodeStatus.Success;
    }
  }

  // Find nearest marketplace and pathfind toward it
  if (markets.length > 0) {
    let nearestDist = Infinity;
    let nearestMarket = markets[0]!;
    for (const mEid of markets) {
      const dx = Position.x[mEid] - px;
      const dy = Position.y[mEid] - py;
      const d = dx * dx + dy * dy;
      if (d < nearestDist) {
        nearestDist = d;
        nearestMarket = mEid;
      }
    }

    Pathfinder.targetX[eid] = Position.x[nearestMarket];
    Pathfinder.targetY[eid] = Position.y[nearestMarket];
    Pathfinder.pathIndex[eid] = 0;
    AIStateComponent.state[eid] = AIState.Seeking as unknown as number;
    setVelocityToward(eid, px, py, Position.x[nearestMarket], Position.y[nearestMarket]);
    return NodeStatus.Running;
  }

  return NodeStatus.Failure;
}

/**
 * Buy action: if hungry and has gold, pathfind to nearest marketplace to buy food.
 * The actual purchase happens in TradeSystem when near the marketplace.
 */
export function buyAction(eid: number, ctx: unknown): NodeStatus {
  const context = ctx as AIContext;
  if (!hasComponent(context.world, eid, Inventory)) return NodeStatus.Failure;
  if (Inventory.gold[eid] <= 0) return NodeStatus.Failure;

  // Same logic as tradeAction — navigate to marketplace
  const px = Position.x[eid];
  const py = Position.y[eid];

  const markets = queryMarkets(context.world);
  for (const marketEid of markets) {
    const dx = Position.x[marketEid] - px;
    const dy = Position.y[marketEid] - py;
    if (dx * dx + dy * dy < (TILE_SIZE * 4) * (TILE_SIZE * 4)) {
      Velocity.x[eid] = 0;
      Velocity.y[eid] = 0;
      AIStateComponent.state[eid] = AIState.Working as unknown as number;
      return NodeStatus.Success;
    }
  }

  if (markets.length > 0) {
    let nearestDist = Infinity;
    let nearestMarket = markets[0]!;
    for (const mEid of markets) {
      const dx = Position.x[mEid] - px;
      const dy = Position.y[mEid] - py;
      const d = dx * dx + dy * dy;
      if (d < nearestDist) {
        nearestDist = d;
        nearestMarket = mEid;
      }
    }

    Pathfinder.targetX[eid] = Position.x[nearestMarket];
    Pathfinder.targetY[eid] = Position.y[nearestMarket];
    Pathfinder.pathIndex[eid] = 0;
    AIStateComponent.state[eid] = AIState.Seeking as unknown as number;
    setVelocityToward(eid, px, py, Position.x[nearestMarket], Position.y[nearestMarket]);
    return NodeStatus.Running;
  }

  return NodeStatus.Failure;
}

/** Query world for marketplace entities. */
function queryMarkets(world: GameWorld): number[] {
  const markets: number[] = [];
  const ents = bitecsQuery(world, [Position, MarketInventory, Structure]);
  for (let i = 0; i < ents.length; i++) {
    markets.push(ents[i]!);
  }
  return markets;
}

export function isHealthLow(eid: number, _ctx: unknown): boolean {
  return Health.current[eid] / Health.max[eid] < 0.3;
}

export function isHungry(eid: number, _ctx: unknown): boolean {
  return Needs.hunger[eid] > 80;
}

export function isTired(eid: number, _ctx: unknown): boolean {
  return Needs.rest[eid] < 20;
}

export function isLonely(eid: number, _ctx: unknown): boolean {
  return Needs.social[eid] < 40;
}

export function isBored(eid: number, _ctx: unknown): boolean {
  return Needs.fun[eid] < 30;
}

export function isInventoryFull(eid: number, _ctx: unknown): boolean {
  if (!hasComponent((_ctx as AIContext).world, eid, Inventory)) return false;
  let total = 0;
  const fields: (keyof typeof Inventory)[] = ['wood', 'food', 'stone', 'gold', 'iron', 'herbs', 'crystal'];
  for (const f of fields) total += Inventory[f][eid];
  return total > 160; // 80% of 200
}

export function needsFoodFromMarket(eid: number, _ctx: unknown): boolean {
  if (!hasComponent((_ctx as AIContext).world, eid, Inventory)) return false;
  return Needs.hunger[eid] > 60 && Inventory.gold[eid] > 0;
}

// ── Utility ────────────────────────────────────────────────────────

function setVelocityToward(
  eid: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): void {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.1) {
    Velocity.x[eid] = 0;
    Velocity.y[eid] = 0;
    return;
  }
  const speed = Pathfinder.speed[eid];
  Velocity.x[eid] = (dx / dist) * speed;
  Velocity.y[eid] = (dy / dist) * speed;
}
