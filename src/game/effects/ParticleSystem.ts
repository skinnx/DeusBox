import Phaser from 'phaser';

/**
 * Generic particle system using simple colored rectangles (pixel art style).
 * No external assets required.
 */
export class ParticleSystem {
  private scene: Phaser.Scene;
  private activeSystems: Map<string, Particle[]> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Rain: blue particles falling from top. */
  createRain(x: number, y: number, width: number, height: number): void {
    this.stopSystem('rain');

    const particles: Particle[] = [];
    const count = Math.min(80, Math.floor((width * height) / 4000));

    for (let i = 0; i < count; i++) {
      const px = x + Math.random() * width;
      const py = y + Math.random() * height;
      const speed = 150 + Math.random() * 100;

      const rect = this.scene.add.rectangle(px, py, 1, 3, 0x6699ff, 0.6);
      rect.setDepth(850);
      rect.setScrollFactor(0);

      particles.push({
        graphics: rect,
        x: px,
        y: py,
        vx: 0,
        vy: speed,
        life: Infinity,
        maxLife: Infinity,
        bounds: { x, y, width, height },
      });
    }

    this.activeSystems.set('rain', particles);
  }

  /** Snow: white particles drifting slowly. */
  createSnow(x: number, y: number, width: number, height: number): void {
    this.stopSystem('snow');

    const particles: Particle[] = [];
    const count = Math.min(60, Math.floor((width * height) / 5000));

    for (let i = 0; i < count; i++) {
      const px = x + Math.random() * width;
      const py = y + Math.random() * height;

      const rect = this.scene.add.rectangle(px, py, 2, 2, 0xffffff, 0.7);
      rect.setDepth(850);
      rect.setScrollFactor(0);

      particles.push({
        graphics: rect,
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 20,
        vy: 30 + Math.random() * 30,
        life: Infinity,
        maxLife: Infinity,
        bounds: { x, y, width, height },
      });
    }

    this.activeSystems.set('snow', particles);
  }

  /** Smoke: gray particles rising from a point. */
  createSmoke(x: number, y: number): void {
    const particles: Particle[] = [];

    for (let i = 0; i < 8; i++) {
      const offsetX = (Math.random() - 0.5) * 16;
      const size = 2 + Math.random() * 3;

      const rect = this.scene.add.rectangle(
        x + offsetX,
        y - Math.random() * 20,
        size,
        size,
        0x888888,
        0.5,
      );
      rect.setDepth(850);

      particles.push({
        graphics: rect,
        x: x + offsetX,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: -(20 + Math.random() * 30),
        life: 1 + Math.random() * 2,
        maxLife: 3,
      });
    }

    this.activeSystems.set(`smoke_${x}_${y}`, particles);
  }

  /** Storm: heavy rain with wind. */
  createStorm(x: number, y: number, width: number, height: number): void {
    this.stopSystem('storm');

    const particles: Particle[] = [];
    const count = Math.min(150, Math.floor((width * height) / 2000));
    const windX = 80 + Math.random() * 60;

    for (let i = 0; i < count; i++) {
      const px = x + Math.random() * width;
      const py = y + Math.random() * height;
      const speed = 250 + Math.random() * 150;

      const rect = this.scene.add.rectangle(px, py, 1, 4, 0x4477cc, 0.7);
      rect.setDepth(850);
      rect.setScrollFactor(0);

      particles.push({
        graphics: rect,
        x: px,
        y: py,
        vx: windX,
        vy: speed,
        life: Infinity,
        maxLife: Infinity,
        bounds: { x, y, width, height },
      });
    }

    this.activeSystems.set('storm', particles);
  }

  /** Fog: large semi-transparent overlays. */
  createFog(x: number, y: number, width: number, height: number): void {
    this.stopSystem('fog');

    const particles: Particle[] = [];
    const cols = Math.ceil(width / 120);
    const rows = Math.ceil(height / 100);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x + c * 120 + Math.random() * 40;
        const py = y + r * 100 + Math.random() * 30;

        const rect = this.scene.add.rectangle(px, py, 130, 110, 0xcccccc, 0.15);
        rect.setDepth(850);
        rect.setScrollFactor(0);

        particles.push({
          graphics: rect,
          x: px,
          y: py,
          vx: 5 + Math.random() * 10,
          vy: (Math.random() - 0.5) * 3,
          life: Infinity,
          maxLife: Infinity,
          bounds: { x, y, width, height },
        });
      }
    }

    this.activeSystems.set('fog', particles);
  }

  /** Blood splatter: red particles at a point. */
  createBloodSplatter(x: number, y: number): void {
    const key = `blood_${Date.now()}`;
    const particles: Particle[] = [];

    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      const size = 1 + Math.random() * 2;

      const rect = this.scene.add.rectangle(x, y, size, size, 0xcc0000, 0.8);
      rect.setDepth(850);

      particles.push({
        graphics: rect,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
      });
    }

    this.activeSystems.set(key, particles);
  }

  update(delta: number): void {
    const dt = delta / 1000;

    for (const [key, particles] of this.activeSystems) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;

        if (p.life !== Infinity) {
          p.life -= dt;
          if (p.life <= 0) {
            p.graphics.destroy();
            particles.splice(i, 1);
            continue;
          }

          // Fade out
          const alpha = Math.max(0, p.life / p.maxLife) * 0.8;
          p.graphics.setAlpha(alpha);
        }

        // Move
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.graphics.setPosition(p.x, p.y);

        // Wrap within bounds (rain/snow)
        if (p.bounds) {
          if (p.y > p.bounds.y + p.bounds.height) {
            p.y = p.bounds.y;
            p.x = p.bounds.x + Math.random() * p.bounds.width;
          }
          if (p.x < p.bounds.x) p.x = p.bounds.x + p.bounds.width;
          if (p.x > p.bounds.x + p.bounds.width) p.x = p.bounds.x;
        }
      }

      // Clean up empty systems (except persistent weather)
      if (particles.length === 0) {
        this.activeSystems.delete(key);
      }
    }
  }

  stopSystem(key: string): void {
    const particles = this.activeSystems.get(key);
    if (particles) {
      for (const p of particles) {
        p.graphics.destroy();
      }
      this.activeSystems.delete(key);
    }
  }

  stopAll(): void {
    for (const [, particles] of this.activeSystems) {
      for (const p of particles) {
        p.graphics.destroy();
      }
    }
    this.activeSystems.clear();
  }

  destroy(): void {
    this.stopAll();
  }
}

interface Particle {
  graphics: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  bounds?: { x: number; y: number; width: number; height: number };
}
