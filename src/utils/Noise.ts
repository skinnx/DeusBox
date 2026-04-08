import { createNoise2D, NoiseFunction2D } from 'simplex-noise';

export class NoiseGenerator {
  private noise2DFn: NoiseFunction2D;

  constructor(seed: number) {
    const seedFn = (): number => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    this.noise2DFn = createNoise2D(seedFn);
  }

  noise2D(x: number, y: number): number {
    return this.noise2DFn(x, y);
  }

  fbm(x: number, y: number, octaves: number, lacunarity: number, gain: number): number {
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    let total = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2DFn(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  ridged(x: number, y: number, octaves: number): number {
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    let total = 0;

    for (let i = 0; i < octaves; i++) {
      let signal = this.noise2DFn(x * frequency, y * frequency);
      signal = 1.0 - Math.abs(signal);
      signal *= signal;
      total += signal * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return total / maxValue;
  }
}
