export interface Point {
  x: number;
  y: number;
}

export enum TileType {
  DeepWater = 'DeepWater',
  ShallowWater = 'ShallowWater',
  Sand = 'Sand',
  Grass = 'Grass',
  Forest = 'Forest',
  DenseForest = 'DenseForest',
  Mountain = 'Mountain',
  Snow = 'Snow',
  Desert = 'Desert',
  Tundra = 'Tundra',
  Lava = 'Lava',
  Void = 'Void',
}

export enum BiomeType {
  Ocean = 'Ocean',
  Beach = 'Beach',
  Plains = 'Plains',
  Forest = 'Forest',
  DenseForest = 'DenseForest',
  Desert = 'Desert',
  Tundra = 'Tundra',
  Mountain = 'Mountain',
  Volcanic = 'Volcanic',
}

export enum Direction {
  North = 'North',
  South = 'South',
  East = 'East',
  West = 'West',
  NorthEast = 'NorthEast',
  NorthWest = 'NorthWest',
  SouthEast = 'SouthEast',
  SouthWest = 'SouthWest',
}

export enum CreatureType {
  Human = 'Human',
  Elf = 'Elf',
  Dwarf = 'Dwarf',
  Orc = 'Orc',
  Wolf = 'Wolf',
  Bear = 'Bear',
  Deer = 'Deer',
  Chicken = 'Chicken',
  Fish = 'Fish',
}

export enum BuildingType {
  House = 'House',
  Farm = 'Farm',
  Warehouse = 'Warehouse',
  Barracks = 'Barracks',
  Temple = 'Temple',
  Wall = 'Wall',
  Road = 'Road',
}

export enum ResourceType {
  Wood = 'Wood',
  Stone = 'Stone',
  Food = 'Food',
  Gold = 'Gold',
  Iron = 'Iron',
}

export enum GodPowerType {
  TerraformGrass = 'TerraformGrass',
  TerraformDesert = 'TerraformDesert',
  TerraformWater = 'TerraformWater',
  TerraformMountain = 'TerraformMountain',
  SpawnHuman = 'SpawnHuman',
  SpawnAnimal = 'SpawnAnimal',
  FireStrike = 'FireStrike',
  LightningStrike = 'LightningStrike',
  Earthquake = 'Earthquake',
  Flood = 'Flood',
  Heal = 'Heal',
}

export enum NeedType {
  Hunger = 'Hunger',
  Rest = 'Rest',
  Social = 'Social',
  Fun = 'Fun',
}

export enum AIState {
  Idle = 'Idle',
  Wandering = 'Wandering',
  Seeking = 'Seeking',
  Working = 'Working',
  Fighting = 'Fighting',
  Fleeing = 'Fleeing',
  Resting = 'Resting',
  Eating = 'Eating',
  Socializing = 'Socializing',
  Dead = 'Dead',
}

export type FactionID = number;
