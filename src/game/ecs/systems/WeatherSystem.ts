import type { GameWorld } from '../ECSHost.js';
import { eventBus } from '@/core/EventBus.js';
import { WeatherType, Season } from '@/core/Types.js';
import { getCachedSeason } from './SeasonSystem.js';
import weatherConfig from '@/data/weather.json';

type WeatherKey = 'clear' | 'rain' | 'storm' | 'fog' | 'snow';
const WEATHER_KEYS: WeatherKey[] = ['clear', 'rain', 'storm', 'fog', 'snow'];

const KEY_TO_TYPE: Record<WeatherKey, WeatherType> = {
  clear: WeatherType.Clear,
  rain: WeatherType.Rain,
  storm: WeatherType.Storm,
  fog: WeatherType.Fog,
  snow: WeatherType.Snow,
};

const TYPE_TO_KEY: Record<WeatherType, WeatherKey> = {
  [WeatherType.Clear]: 'clear',
  [WeatherType.Rain]: 'rain',
  [WeatherType.Storm]: 'storm',
  [WeatherType.Fog]: 'fog',
  [WeatherType.Snow]: 'snow',
};

interface WeatherProbabilities {
  clear: number;
  rain: number;
  storm: number;
  fog: number;
  snow: number;
}

interface WeatherEffects {
  movement: Record<WeatherKey, number>;
  needs: {
    hunger: Record<WeatherKey, number>;
    rest: Record<WeatherKey, number>;
  };
  aggro: Record<WeatherKey, number>;
}

const seasons = weatherConfig.seasons as Record<Season, WeatherProbabilities>;
const effects = weatherConfig.effects as WeatherEffects;
const interval = weatherConfig.weatherInterval as { min: number; max: number };

let currentWeather: WeatherType = WeatherType.Clear;
let currentIntensity = 0;
let nextChangeTime = 0;

function pickWeather(season: Season): WeatherType {
  const probs = seasons[season];
  const r = Math.random();
  let cumulative = 0;
  for (const key of WEATHER_KEYS) {
    cumulative += probs[key];
    if (r <= cumulative) return KEY_TO_TYPE[key];
  }
  return WeatherType.Clear;
}

export function getCurrentWeather(): WeatherType {
  return currentWeather;
}

export function getCurrentWeatherIntensity(): number {
  return currentIntensity;
}

export function getWeatherMovementModifier(): number {
  return effects.movement[TYPE_TO_KEY[currentWeather]];
}

export function getWeatherNeedsModifier(need: 'hunger' | 'rest'): number {
  return effects.needs[need][TYPE_TO_KEY[currentWeather]];
}

export function getWeatherAggroModifier(): number {
  return effects.aggro[TYPE_TO_KEY[currentWeather]];
}

export function createWeatherSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, _delta: number): void => {
    const elapsed = world.time.elapsed;

    if (elapsed >= nextChangeTime) {
      const season = getCachedSeason();
      const weather = pickWeather(season);
      const intensity = 0.3 + Math.random() * 0.7;

      currentWeather = weather;
      currentIntensity = intensity;

      nextChangeTime = elapsed + interval.min + Math.random() * (interval.max - interval.min);

      eventBus.emit('weather:changed', { weather, intensity });
    }
  };
}
