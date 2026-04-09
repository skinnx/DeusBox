import Phaser from 'phaser';
import { perfMonitor, type PerformanceSnapshot } from '@/core/PerformanceMonitor.js';
import { settings } from '@/core/Settings.js';

export class DebugOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private fpsText: Phaser.GameObjects.Text;
  private entityText: Phaser.GameObjects.Text;
  private memoryText: Phaser.GameObjects.Text;
  private deltaText: Phaser.GameObjects.Text;
  private graphCanvas: Phaser.GameObjects.Graphics;
  private fpsGraph: number[] = [];
  private visible = false;
  private frameCounter = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(10, 80);
    this.container.setScrollFactor(0);
    this.container.setDepth(2500);

    this.background = scene.add.rectangle(0, 0, 180, 120, 0x000000, 0.85);
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(1, 0x333333);
    this.container.add(this.background);

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#2ecc71',
    };

    this.fpsText = scene.add.text(8, 6, 'FPS: --', textStyle);
    this.container.add(this.fpsText);

    this.entityText = scene.add.text(8, 22, 'Entities: --', { ...textStyle, color: '#3498db' });
    this.container.add(this.entityText);

    this.memoryText = scene.add.text(8, 38, 'Memory: --', { ...textStyle, color: '#e67e22' });
    this.container.add(this.memoryText);

    this.deltaText = scene.add.text(8, 54, 'Delta: --', { ...textStyle, color: '#95a5a6' });
    this.container.add(this.deltaText);

    this.graphCanvas = scene.add.graphics();
    this.graphCanvas.setPosition(8, 72);
    this.container.add(this.graphCanvas);

    this.visible = settings.getGameplay().showFPS;
    this.container.setVisible(this.visible);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
    settings.update({ gameplay: { showFPS: this.visible } });
  }

  update(): void {
    if (!this.visible) return;

    this.frameCounter++;
    if (this.frameCounter % 10 !== 0) return;

    const snap = perfMonitor.getSnapshot();

    this.fpsText.setText(`FPS: ${snap.fps.toFixed(0)} (avg ${snap.avgFps.toFixed(0)})`);
    this.fpsText.setColor(perfMonitor.getFPSColor());

    this.entityText.setText(`Entities: ${snap.entityCount}`);

    if (snap.heapUsedMB > 0) {
      this.memoryText.setText(`Heap: ${snap.heapUsedMB.toFixed(1)}MB / ${snap.memoryMB.toFixed(0)}MB`);
    } else {
      this.memoryText.setText('Memory: N/A');
    }

    this.deltaText.setText(`Delta: ${snap.deltaMs.toFixed(1)}ms`);

    this.fpsGraph.push(snap.fps);
    if (this.fpsGraph.length > 60) {
      this.fpsGraph.shift();
    }
    this.drawGraph();
  }

  private drawGraph(): void {
    this.graphCanvas.clear();

    const w = 164;
    const h = 40;

    this.graphCanvas.fillStyle(0x111111, 0.8);
    this.graphCanvas.fillRect(0, 0, w, h);

    this.graphCanvas.lineStyle(1, 0x333333, 0.5);
    this.graphCanvas.lineBetween(0, h / 2, w, h / 2);

    if (this.fpsGraph.length < 2) return;

    this.graphCanvas.lineStyle(1, 0x2ecc71, 0.8);
    this.graphCanvas.beginPath();

    for (let i = 0; i < this.fpsGraph.length; i++) {
      const x = (i / 59) * w;
      const fps = Math.min(120, this.fpsGraph[i]!);
      const y = h - (fps / 120) * h;

      if (i === 0) {
        this.graphCanvas.moveTo(x, y);
      } else {
        this.graphCanvas.lineTo(x, y);
      }
    }

    this.graphCanvas.strokePath();
  }

  destroy(): void {
    this.container.destroy();
  }
}
