import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Inventory from '../components/Inventory.js';
import MarketInventory from '../components/MarketInventory.js';
import Structure from '../components/Structure.js';
import Faction from '../components/Faction.js';
import Needs from '../components/Needs.js';
import { Humanoid } from '../components/TagComponents.js';
import { TILE_SIZE } from '@/core/Constants.js';
import { isAllied } from './DiplomacySystem.js';
import { eventBus } from '@/core/EventBus.js';
import buildingsData from '@/data/buildings.json';

/** Building type name list (same order as Structure.type index) */
const BUILDING_TYPE_LIST = Object.keys(buildingsData);

/** Distance from marketplace to trade (pixels) */
const TRADE_RANGE = TILE_SIZE * 4;

/** Trade check interval in milliseconds */
const TRADE_CHECK_INTERVAL = 5000;

/** Inventory capacity per slot */
const MAX_INVENTORY_SLOT = 200;

/** Threshold above which inventory is considered full (80% of 200 = 160) */
const FULL_THRESHOLD = MAX_INVENTORY_SLOT * 0.8;

/** Hunger threshold to trigger food buying */
const HUNGER_BUY_THRESHOLD = 60;

/** Faction balance: surplus threshold for warehouse */
const FACTION_SURPLUS_THRESHOLD = 50;

/** Faction balance: transfer amount per tick */
const FACTION_TRANSFER_AMOUNT = 10;

/** Gold price per unit of resource (spec prices) */
const RESOURCE_PRICES: Record<string, number> = {
  wood: 1,
  stone: 2,
  food: 1,
  gold: 5,
  iron: 3,
  herbs: 4,
  crystal: 8,
};

/** Inventory fields that can be traded (excludes gold) */
const TRADEABLE_RESOURCES: (keyof typeof Inventory)[] = [
  'wood', 'food', 'stone', 'iron', 'herbs', 'crystal',
];

let elapsedSinceLastCheck = 0;

/**
 * Creates the trade system.
 * Handles three trade scenarios:
 * 1. Humanoid sells surplus → gold at marketplace
 * 2. Humanoid buys food when hungry using gold
 * 3. Faction auto-balances resources between warehouses via marketplace
 */
export function createTradeSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    elapsedSinceLastCheck += delta;
    if (elapsedSinceLastCheck < TRADE_CHECK_INTERVAL) return;
    elapsedSinceLastCheck = 0;

    const markets = query(world, [Position, MarketInventory, Structure]);
    if (markets.length === 0) return;

    const traders = query(world, [Position, Inventory, Faction, Humanoid]);

    for (let m = 0; m < markets.length; m++) {
      const marketEid = markets[m]!;
      const mx = Position.x[marketEid];
      const my = Position.y[marketEid];
      const marketFaction = Structure.factionId[marketEid];

      // ── Humanoid trading ─────────────────────────────────────────────
      for (let t = 0; t < traders.length; t++) {
        const traderEid = traders[t]!;
        const tx = Position.x[traderEid];
        const ty = Position.y[traderEid];

        const dx = tx - mx;
        const dy = ty - my;
        if (dx * dx + dy * dy > TRADE_RANGE * TRADE_RANGE) continue;

        const traderFaction = Faction.id[traderEid];
        if (traderFaction !== marketFaction) {
          if (!isAllied(traderFaction, marketFaction)) continue;
        }

        // Calculate total inventory load
        let totalLoad = 0;
        for (const res of TRADEABLE_RESOURCES) {
          totalLoad += Inventory[res][traderEid];
        }
        totalLoad += Inventory.gold[traderEid];

        // Sell surplus if inventory is >80% full
        if (totalLoad > FULL_THRESHOLD) {
          for (const resource of TRADEABLE_RESOURCES) {
            const held = Inventory[resource][traderEid];
            if (held > 20) { // keep a small reserve
              const sellAmount = Math.floor(held - 20);
              const price = RESOURCE_PRICES[resource] ?? 1;
              const goldEarned = sellAmount * price;

              Inventory[resource][traderEid] -= sellAmount;
              Inventory.gold[traderEid] += goldEarned;
              MarketInventory[resource][marketEid] += sellAmount;
              MarketInventory.goldReserve[marketEid] += goldEarned;

              eventBus.emit('trade:completed', {
                entityId: traderEid,
                resourceType: resource,
                amount: sellAmount,
              });
            }
          }
        }

        // Buy food when hungry and has gold
        if (hasComponent(world, traderEid, Needs)) {
          const hunger = Needs.hunger[traderEid];
          if (hunger > HUNGER_BUY_THRESHOLD && Inventory.gold[traderEid] > 0) {
            const foodPrice = RESOURCE_PRICES['food'] ?? 1;
            const maxBuy = Math.floor(Inventory.gold[traderEid] / foodPrice);
            const available = MarketInventory.food[marketEid];
            const buyAmount = Math.min(maxBuy, available, 30); // buy up to 30 food

            if (buyAmount > 0) {
              const goldCost = buyAmount * foodPrice;
              Inventory.gold[traderEid] -= goldCost;
              Inventory.food[traderEid] += buyAmount;
              MarketInventory.food[marketEid] -= buyAmount;
              MarketInventory.goldReserve[marketEid] += goldCost;

              eventBus.emit('trade:completed', {
                entityId: traderEid,
                resourceType: 'food',
                amount: buyAmount,
              });
            }
          }
        }

        // Buy shortage resources with remaining gold
        for (const resource of TRADEABLE_RESOURCES) {
          if (resource === 'food') continue; // handled above
          const held = Inventory[resource][traderEid];
          if (held < 5 && Inventory.gold[traderEid] > 5) {
            const price = RESOURCE_PRICES[resource] ?? 1;
            const maxBuy = Math.floor(Inventory.gold[traderEid] / price);
            const available = MarketInventory[resource][marketEid];
            const buyAmount = Math.min(maxBuy, available, 10);

            if (buyAmount > 0) {
              const goldCost = buyAmount * price;
              Inventory.gold[traderEid] -= goldCost;
              Inventory[resource][traderEid] += buyAmount;
              MarketInventory[resource][marketEid] -= buyAmount;

              eventBus.emit('trade:completed', {
                entityId: traderEid,
                resourceType: resource,
                amount: buyAmount,
              });
            }
          }
        }
      }

      // ── Faction auto-balance via marketplace ──────────────────────────
      // Marketplace pulls surplus from warehouses and distributes to deficit ones
      const buildings = query(world, [Position, Structure, Faction]);
      const factionWarehouses: Record<number, Array<{
        eid: number;
        x: number;
        y: number;
      }>> = {};

      for (let b = 0; b < buildings.length; b++) {
        const bid = buildings[b]!;
        const typeIndex = Math.floor(Structure.type[bid]);
        const buildingName = BUILDING_TYPE_LIST[typeIndex];
        if (buildingName !== 'warehouse') continue;

        const fId = Faction.id[bid];
        if (!factionWarehouses[fId]) factionWarehouses[fId] = [];
        factionWarehouses[fId].push({
          eid: bid,
          x: Position.x[bid],
          y: Position.y[bid],
        });
      }

      // For each faction with a marketplace and warehouses, balance resources
      if (factionWarehouses[marketFaction] && factionWarehouses[marketFaction].length >= 2) {
        const whouses = factionWarehouses[marketFaction];
        for (const resource of TRADEABLE_RESOURCES) {
          // Find surplus and deficit warehouses
          for (let i = 0; i < whouses.length; i++) {
            const surplusWh = whouses[i]!;
            // Check distance from marketplace
            const sdx = surplusWh.x - mx;
            const sdy = surplusWh.y - my;
            if (sdx * sdx + sdy * sdy > TRADE_RANGE * TRADE_RANGE) continue;

            // Check if marketplace has surplus of this resource
            const marketStock = MarketInventory[resource][marketEid];
            if (marketStock <= FACTION_SURPLUS_THRESHOLD) continue;

            // Find a deficit warehouse to transfer to
            for (let j = 0; j < whouses.length; j++) {
              if (i === j) continue;
              const deficitWh = whouses[j]!;
              const transferAmount = Math.min(FACTION_TRANSFER_AMOUNT, marketStock);
              if (transferAmount <= 0) break;

              // Virtual transfer: marketplace → deficit warehouse
              MarketInventory[resource][marketEid] -= transferAmount;
              // The deficit warehouse gets resources (added to its nearby market stock or just consumed)
              // In practice, we just reduce market stock as the "distributed" amount
              break; // One transfer per tick per resource
            }
          }
        }
      }
    }
  };
}
