import { MAX_ENTITIES } from '@/core/Constants.js';

/**
 * MarketInventory stores resource stock and prices for marketplace buildings.
 * Each field is indexed by entity ID (the marketplace entity).
 */
const MarketInventory = {
  wood: new Float32Array(MAX_ENTITIES),
  food: new Float32Array(MAX_ENTITIES),
  stone: new Float32Array(MAX_ENTITIES),
  gold: new Float32Array(MAX_ENTITIES),
  iron: new Float32Array(MAX_ENTITIES),
  herbs: new Float32Array(MAX_ENTITIES),
  crystal: new Float32Array(MAX_ENTITIES),
  /** Gold reserve: total gold earned from trades (used for buying) */
  goldReserve: new Float32Array(MAX_ENTITIES),
};

export default MarketInventory;
