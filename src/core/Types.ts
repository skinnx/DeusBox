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
  Swamp = 'Swamp',
  Coral = 'Coral',
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
  Swamp = 'Swamp',
  CoralReef = 'CoralReef',
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
  Marketplace = 'Marketplace',
}

export enum ResourceType {
  Wood = 'Wood',
  Stone = 'Stone',
  Food = 'Food',
  Gold = 'Gold',
  Iron = 'Iron',
  Herbs = 'Herbs',
  Crystal = 'Crystal',
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

export enum MilitaryRoleType {
  None = 'None',
  Warrior = 'Warrior',
  Archer = 'Archer',
  Mage = 'Mage',
}

export enum Season {
  Spring = 'Spring',
  Summer = 'Summer',
  Autumn = 'Autumn',
  Winter = 'Winter',
}

export enum WeatherType {
  Clear = 'Clear',
  Rain = 'Rain',
  Storm = 'Storm',
  Fog = 'Fog',
  Snow = 'Snow',
}

export type FactionID = number;

export enum DiplomacyState {
  Neutral = 'Neutral',
  Allied = 'Allied',
  AtWar = 'AtWar',
  Ceasefire = 'Ceasefire',
}

export enum WeaponType {
  None = 'None',
  Sword = 'Sword',
  Bow = 'Bow',
  Staff = 'Staff',
}

export enum ArmorType {
  None = 'None',
  Leather = 'Leather',
  Chain = 'Chain',
  Plate = 'Plate',
}

export enum TechType {
  BasicTools = 'BasicTools',
  Agriculture = 'Agriculture',
  AdvancedWeapons = 'AdvancedWeapons',
  Fortification = 'Fortification',
  Arcane = 'Arcane',
  SiegeWarfare = 'SiegeWarfare',
  Marketplace = 'Marketplace',
  AdvancedArmor = 'AdvancedArmor',
}
