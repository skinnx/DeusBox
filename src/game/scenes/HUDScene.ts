import Phaser from 'phaser';
import { hasComponent } from 'bitecs';
import { TILE_SIZE } from '@/core/Constants.js';
import { TimeControls } from '@/ui/TimeControls.js';
import { TopBar } from '@/ui/TopBar.js';
import { GodPanel } from '@/ui/GodPanel.js';
import { BrushSizeSelector } from '@/ui/BrushSizeSelector.js';
import { Minimap } from '@/ui/Minimap.js';
import { EntityInfoPanel } from '@/ui/EntityInfoPanel.js';
import { SaveManager } from '@/game/save/SaveManager.js';
import { AudioManager } from '@/game/audio/AudioManager.js';
import Position from '@/game/ecs/components/Position.js';
import { Selectable } from '@/game/ecs/components/TagComponents.js';
import { SelectionManager } from '@/ui/SelectionManager.js';
import { ContextMenu } from '@/ui/ContextMenu.js';
import { Tooltip } from '@/ui/Tooltip.js';
import { DragSelect } from '@/ui/DragSelect.js';
import { DamageNumbers } from '@/ui/DamageNumbers.js';
import { NotificationSystem } from '@/ui/NotificationSystem.js';
import { TerritoryOverlay } from '@/ui/TerritoryOverlay.js';
import { eventBus } from '@/core/EventBus.js';
import { DebugOverlay } from '@/ui/DebugOverlay.js';
import { settings } from '@/core/Settings.js';

const PANEL_WIDTH = 180;

export class HUDScene extends Phaser.Scene {
  private timeControls: TimeControls | null = null;
  private topBar: TopBar | null = null;
  private godPanel: GodPanel | null = null;
  private brushSelector: BrushSizeSelector | null = null;
  private minimap: Minimap | null = null;
  private entityInfoPanel: EntityInfoPanel | null = null;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private speedMultiplier: number = 1;

  // Wave 7: Save/Load UI
  private saveButtons: Phaser.GameObjects.Container[] = [];
  private saveContainer: Phaser.GameObjects.Container | null = null;
  private savePanelBg: Phaser.GameObjects.Rectangle | null = null;

  // Wave 7: Sound toggle
  private soundButton: Phaser.GameObjects.Container | null = null;
  private soundLabel: Phaser.GameObjects.Text | null = null;

  // Wave 7: Day/Time display
  private dayTimeText: Phaser.GameObjects.Text | null = null;

  // Wave 7: Save notification
  private saveNotification: Phaser.GameObjects.Text | null = null;
  private saveNotifyTimer: number = 0;

  private audioManager: AudioManager;

  // Wave 8: Selection & interaction systems
  private selectionManager: SelectionManager;
  private contextMenu: ContextMenu;
  private tooltip: Tooltip;
  private dragSelect: DragSelect;
  private selectionCountText: Phaser.GameObjects.Text | null = null;

  // Hover tracking
  private lastHoveredEntityId: number | null = null;

  // Wave 19: Visual polish UI
  private damageNumbers: DamageNumbers | null = null;
  private notificationSystem: NotificationSystem | null = null;
  private territoryOverlay: TerritoryOverlay | null = null;
  private debugOverlay: DebugOverlay | null = null;

  constructor() {
    super('HUD');
    this.audioManager = AudioManager.getInstance();
    this.selectionManager = SelectionManager.getInstance();
    this.contextMenu = new ContextMenu(this);
    this.tooltip = new Tooltip(this);
    this.dragSelect = new DragSelect(this);
  }

  create(): void {
    console.log('[HUDScene] HUD initialized');

    // Prevent HUD from capturing game keyboard input
    this.input.keyboard!.enabled = false;

    // Provide Tooltip with GameScene keyboard reference
    const gameSceneObj = this.getGameSceneObject();
    if (gameSceneObj) {
      this.tooltip.initGameKeyboard(gameSceneObj);
    }

    // Initialize ContextMenu, Tooltip & DragSelect containers (can't be done in constructor before scene is ready)
    this.contextMenu.init();
    this.tooltip.init();
    this.dragSelect.init();

    const { width, height } = this.scale;

    // 1. Time Controls (top-center)
    this.timeControls = new TimeControls(this, width / 2, 22, (multiplier: number) =>
      this.onSpeedChange(multiplier),
    );

    // 2. Top Bar (top-left)
    this.topBar = new TopBar(this);

    // 3. God Panel (bottom-center)
    this.godPanel = new GodPanel(this, (powerName: string | null) => {
      this.onPowerSelect(powerName);
    });

    // 4. Brush Size Selector (bottom-center, next to GodPanel)
    this.brushSelector = new BrushSizeSelector(this, width / 2 + 160, height - 26, (size: number) =>
      this.onBrushSizeChange(size),
    );

    // 5. Minimap (bottom-left)
    this.minimap = new Minimap(this, this.getTileMap(), 10, height - 194, 180);

    // 6. Entity Info Panel (right side, middle)
    this.entityInfoPanel = new EntityInfoPanel(this, width - PANEL_WIDTH - 10, height / 2 - 130);

    // 7. FPS counter (top-left, below TopBar)
    this.fpsText = this.add.text(10, 64, 'FPS: --', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#95a5a6',
    });
    this.fpsText.setScrollFactor(0);
    this.fpsText.setDepth(1000);

    // 8. Selection count text (next to TopBar)
    this.selectionCountText = this.add.text(10, 48, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f1c40f',
    });
    this.selectionCountText.setScrollFactor(0);
    this.selectionCountText.setDepth(1000);

    // 9. Listen for entity selection clicks on GameScene
    this.setupEntitySelection();

    // 10. Setup drag-select, context menu, and tooltip input hooks on GameScene
    this.setupDragSelect();
    this.setupContextMenu();
    this.setupTooltip();
    this.setupSelectionChangeListener();

    // ── Wave 7: Save/Load UI ──────────────────────────────────────────

    this.createSaveUI(width, height);

    // ── Wave 7: Sound toggle ──────────────────────────────────────────

    this.createSoundToggle(width, height);

    // ── Wave 7: Day/Time display ──────────────────────────────────────

    this.createDayTimeDisplay(width);

    // ── Wave 7: Save notification ─────────────────────────────────────

    this.saveNotification = this.add.text(width / 2, 70, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#2ecc71',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 },
    });
    this.saveNotification.setOrigin(0.5, 0.5);
    this.saveNotification.setScrollFactor(0);
    this.saveNotification.setDepth(1001);
    this.saveNotification.setVisible(false);

    // ── Wave 19: Damage numbers, notifications, territory overlay ────────
    this.damageNumbers = new DamageNumbers(this);
    this.notificationSystem = new NotificationSystem(this);

    const tileMap = this.getTileMap();
    this.territoryOverlay = new TerritoryOverlay(this, tileMap.width, tileMap.height);

    // Territory toggle key 'T' on GameScene keyboard
    const gameObjForKeys = this.getGameSceneObject();
    if (gameObjForKeys && gameObjForKeys.input.keyboard) {
      gameObjForKeys.input.keyboard.on('keydown-T', () => {
        if (this.territoryOverlay) this.territoryOverlay.toggle();
      });
    }

    // Debug overlay
    this.debugOverlay = new DebugOverlay(this);

    // F3 to toggle debug overlay
    if (gameObjForKeys && gameObjForKeys.input.keyboard) {
      gameObjForKeys.input.keyboard.on('keydown-F3', () => {
        if (this.debugOverlay) this.debugOverlay.toggle();
      });

      // ESC to open settings
      gameObjForKeys.input.keyboard.on('keydown-ESC', () => {
        this.scene.pause('Game');
        this.scene.pause('HUD');
        this.scene.launch('Settings', { returnTo: 'HUD' });
      });
    }

    // Handle resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  // ── Wave 8: Drag-select setup ─────────────────────────────────────

  private setupDragSelect(): void {
    const gameScene = this.getGameSceneObject();
    if (!gameScene) return;
    const gameInput = gameScene.input;

    gameInput.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const inputHandler = this.getInputHandler();
      if (inputHandler && inputHandler.getActivePower()) return;
      this.dragSelect.onPointerDown(pointer, this.isShiftDown());
    });

    gameInput.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.dragSelect.onPointerMove(pointer);
    });

    gameInput.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const shiftKey = this.isShiftDown();
      const wasDrag = this.dragSelect.onPointerUp(
        pointer,
        shiftKey,
        this.getECSWorld(),
        this.getSpritesMap(),
      );

      // If it was a drag selection, don't do single-click selection
      if (wasDrag) return;
    });
  }

  // ── Wave 8: Context menu setup ─────────────────────────────────────

  private setupContextMenu(): void {
    const gameScene = this.getGameSceneObject();
    if (!gameScene) return;
    const gameInput = gameScene.input;

    // Right-click: open context menu
    gameInput.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) return;

      // Don't open if context menu is already visible (click outside will close)
      if (this.contextMenu.getIsVisible()) {
        this.contextMenu.hide();
        return;
      }

      const world = this.getECSWorld();
      const cam = gameScene.cameras.main;
      const worldX = cam.scrollX + pointer.x / cam.zoom;
      const worldY = cam.scrollY + pointer.y / cam.zoom;

      // Find entity under cursor
      const sprites = this.getSpritesMap();
      let closestEid: number | null = null;
      let closestDist = 24;

      if (world && sprites) {
        for (const [eid, sprite] of sprites) {
          if (!hasComponent(world, eid, Selectable)) continue;
          const dx = sprite.x - worldX;
          const dy = sprite.y - worldY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestEid = eid;
          }
        }
      }

      if (closestEid !== null && world) {
        this.contextMenu.showForEntity(pointer.x, pointer.y, closestEid, world);
      } else {
        this.contextMenu.showForEmptyTile(pointer.x, pointer.y);
      }
    });

    // Click outside context menu closes it
    gameInput.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      if (this.contextMenu.getIsVisible()) {
        this.contextMenu.hide();
      }
    });

    // Escape closes context menu — set up on GameScene keyboard
    const gameKeyboard = gameScene.input.keyboard;
    if (gameKeyboard) {
      gameKeyboard.on('keydown-ESC', () => {
        if (this.contextMenu.getIsVisible()) {
          this.contextMenu.hide();
        }
      });

      // 'C' key opens context menu at cursor
      gameKeyboard.on('keydown-C', () => {
        if (this.contextMenu.getIsVisible()) {
          this.contextMenu.hide();
          return;
        }
        const pointer = gameScene.input.activePointer;
        this.contextMenu.showForEmptyTile(pointer.x, pointer.y);
      });
    }

    // Listen for context menu actions to integrate with EntityInfoPanel
    eventBus.on('contextmenu:action', (data) => {
      if (data.action === 'inspect' && data.entityId >= 0) {
        const world = this.getECSWorld();
        if (world) {
          this.entityInfoPanel?.selectEntity(data.entityId, world);
        }
      }
    });
  }

  // ── Wave 8: Tooltip setup ─────────────────────────────────────────

  private setupTooltip(): void {
    // Listen for entity:hover events from GameScene
    eventBus.on('entity:hover', (data) => {
      const world = this.getECSWorld();
      if (!world) return;

      const gameScene = this.scene.get('Game');
      const pointer = gameScene.input.activePointer;

      if (data.entityId >= 0) {
        this.tooltip.startHover(data.entityId, world, pointer);
        this.lastHoveredEntityId = data.entityId;
      } else {
        this.tooltip.hide();
        this.lastHoveredEntityId = null;
      }
    });
  }

  // ── Wave 8: Selection change listener ─────────────────────────────

  private setupSelectionChangeListener(): void {
    eventBus.on('selection:changed', (data) => {
      // Update selection count text
      if (this.selectionCountText) {
        const count = data.selectedIds.length;
        this.selectionCountText.setText(count > 0 ? `Selected: ${count}` : '');
      }

      // If single entity selected, show in EntityInfoPanel
      if (data.selectedIds.length === 1) {
        const world = this.getECSWorld();
        if (world) {
          this.entityInfoPanel?.selectEntity(data.selectedIds[0], world);
        }
      } else if (data.selectedIds.length === 0) {
        this.entityInfoPanel?.deselect();
      }
    });
  }

  shutdown(): void {
    eventBus.removeAllListeners('entity:hover');
    eventBus.removeAllListeners('selection:changed');
    eventBus.removeAllListeners('contextmenu:action');
  }

  private createSaveUI(width: number, height: number): void {
    const panelX = width - 60;
    const panelY = 10;

    this.saveContainer = this.add.container(panelX, panelY);
    this.saveContainer.setScrollFactor(0);
    this.saveContainer.setDepth(1000);

    // Background panel
    this.savePanelBg = this.add.rectangle(0, 0, 54, 120, 0x000000, 0.6);
    this.savePanelBg.setOrigin(0, 0);
    this.saveContainer.add(this.savePanelBg);

    // Title
    const title = this.add.text(27, 8, 'SAVE', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#f1c40f',
    });
    title.setOrigin(0.5, 0);
    this.saveContainer.add(title);

    // Save slots
    for (let slot = 1; slot <= 3; slot++) {
      const btnY = 22 + (slot - 1) * 32;

      const btnContainer = this.add.container(27, btnY);
      btnContainer.setScrollFactor(0);

      const btnBg = this.add.rectangle(0, 0, 48, 26, 0x333333, 0.8);
      btnBg.setOrigin(0.5, 0.5);
      btnBg.setStrokeStyle(1, 0x555555);

      const hasSave = SaveManager.hasSave(slot);
      const info = SaveManager.getSaveInfo(slot);
      const label =
        hasSave && info
          ? `S${slot}: ${new Date(info.timestamp).toLocaleTimeString()}`
          : `Slot ${slot}: Empty`;

      const btnText = this.add.text(0, 0, label, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: hasSave ? '#ecf0f1' : '#666666',
      });
      btnText.setOrigin(0.5, 0.5);

      btnContainer.add([btnBg, btnText]);
      btnContainer.setSize(48, 26);
      btnContainer.setInteractive({ useHandCursor: true });

      // Left click = Load
      btnContainer.on('pointerdown', () => {
        this.audioManager.init();
        this.audioManager.playUIClick();
        this.loadSlot(slot);
      });

      // Right click = Save
      btnContainer.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          this.audioManager.playUIClick();
          this.saveToSlot(slot);
        }
      });

      btnContainer.on('pointerover', () => {
        btnBg.setFillStyle(0x555555, 0.9);
        this.audioManager.playButtonHover();
      });

      btnContainer.on('pointerout', () => {
        btnBg.setFillStyle(0x333333, 0.8);
      });

      this.saveButtons.push(btnContainer);
      this.saveContainer.add(btnContainer);
    }
  }

  private createSoundToggle(width: number, _height: number): void {
    this.soundButton = this.add.container(width - 33, 142);
    this.soundButton.setScrollFactor(0);
    this.soundButton.setDepth(1000);

    const bg = this.add.rectangle(0, 0, 48, 22, 0x333333, 0.8);
    bg.setOrigin(0.5, 0.5);
    bg.setStrokeStyle(1, 0x555555);

    this.soundLabel = this.add.text(0, 0, 'Sound: ON', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#ecf0f1',
    });
    this.soundLabel.setOrigin(0.5, 0.5);

    this.soundButton.add([bg, this.soundLabel]);
    this.soundButton.setSize(48, 22);
    this.soundButton.setInteractive({ useHandCursor: true });

    this.soundButton.on('pointerdown', () => {
      const enabled = !this.audioManager.isEnabled();
      this.audioManager.setEnabled(enabled);
      if (this.soundLabel) {
        this.soundLabel.setText(enabled ? 'Sound: ON' : 'Sound: OFF');
      }
      this.audioManager.init();
      this.audioManager.playUIClick();
    });

    this.soundButton.on('pointerover', () => {
      bg.setFillStyle(0x555555, 0.9);
    });

    this.soundButton.on('pointerout', () => {
      bg.setFillStyle(0x333333, 0.8);
    });
  }

  private createDayTimeDisplay(width: number): void {
    this.dayTimeText = this.add.text(width / 2 + 90, 22, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#f39c12',
    });
    this.dayTimeText.setOrigin(0, 0.5);
    this.dayTimeText.setScrollFactor(0);
    this.dayTimeText.setDepth(1000);
  }

  private saveToSlot(slot: number): void {
    const gameScene = this.getGameScene();
    if (!gameScene) return;

    const data = gameScene.getSaveGameData();
    const success = SaveManager.save(slot, data);

    this.showNotification(success ? `Saved to slot ${slot}` : `Save failed!`);
    this.refreshSaveButtons();
  }

  private loadSlot(slot: number): void {
    if (!SaveManager.hasSave(slot)) {
      this.showNotification(`Slot ${slot} is empty`);
      return;
    }

    const gameScene = this.getGameScene();
    if (!gameScene) return;

    gameScene.loadFromSave(slot);
    this.showNotification(`Loaded slot ${slot}`);
  }

  private showNotification(text: string): void {
    if (this.saveNotification) {
      this.saveNotification.setText(text);
      this.saveNotification.setVisible(true);
      this.saveNotifyTimer = 2000; // Show for 2 seconds
    }
  }

  private refreshSaveButtons(): void {
    // Rebuild save button labels
    for (let i = 0; i < this.saveButtons.length; i++) {
      const slot = i + 1;
      const container = this.saveButtons[i]!;
      const texts = container.getAll('type', 'Text') as Phaser.GameObjects.Text[];

      const hasSave = SaveManager.hasSave(slot);
      const info = SaveManager.getSaveInfo(slot);
      const label =
        hasSave && info
          ? `S${slot}: ${new Date(info.timestamp).toLocaleTimeString()}`
          : `Slot ${slot}: Empty`;

      for (const txt of texts) {
        txt.setText(label);
        txt.setColor(hasSave ? '#ecf0f1' : '#666666');
      }
    }
  }

  private getGameScene(): import('@/game/scenes/GameScene.js').GameScene | null {
    const scene = this.scene.get('Game');
    if (!scene) return null;
    return scene as unknown as import('@/game/scenes/GameScene.js').GameScene;
  }

  private setupEntitySelection(): void {
    const gameScene = this.scene.get('Game');
    const gameInput = gameScene.input;

    // Listen for pointer down on GameScene to select entities
    gameInput.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Only select on left click without active god power
      if (!pointer.leftButtonDown()) return;

      const inputHandler = this.getInputHandler();
      if (inputHandler && inputHandler.getActivePower()) return;

      // Skip if drag-select is active — drag-select handles its own selection
      if (this.dragSelect.getIsDragging()) return;

      // Convert screen coords to world coords
      const cam = gameScene.cameras.main;
      const worldX = cam.scrollX + pointer.x / cam.zoom;
      const worldY = cam.scrollY + pointer.y / cam.zoom;

      // Find closest entity within selection radius
      const world = this.getECSWorld();
      if (!world) return;

      const sprites = this.getSpritesMap();
      if (!sprites) return;

      const SELECT_RADIUS = 20;
      let closestEid: number | null = null;
      let closestDist = SELECT_RADIUS;

      for (const [eid, sprite] of sprites) {
        if (!hasComponent(world, eid, Selectable)) continue;

        const dx = sprite.x - worldX;
        const dy = sprite.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < closestDist) {
          closestDist = dist;
          closestEid = eid;
        }
      }

      const shiftKey = this.isShiftDown();

      if (closestEid !== null) {
        if (shiftKey) {
          // Toggle selection
          if (this.selectionManager.isSelected(closestEid)) {
            this.selectionManager.removeFromSelection(closestEid);
          } else {
            this.selectionManager.addToSelection(closestEid);
          }
        } else {
          this.selectionManager.select(closestEid);
        }
      } else {
        // Click on empty space without drag — deselect all
        this.selectionManager.deselectAll();
      }
    });
  }

  private onSpeedChange(multiplier: number): void {
    this.speedMultiplier = multiplier;
    const gameScene = this.getGameScene();

    if (gameScene) {
      gameScene.setSpeedMultiplier(multiplier);

      if (multiplier === 0) {
        gameScene.scene.pause('Game');
      } else {
        if (gameScene.scene.isPaused('Game')) {
          gameScene.scene.resume('Game');
        }
      }
    }
  }

  private onPowerSelect(powerName: string | null): void {
    const inputHandler = this.getInputHandler();
    if (inputHandler) {
      // Convert json key to enum key for InputHandler
      if (powerName) {
        const enumName = powerName.charAt(0).toUpperCase() + powerName.slice(1);
        inputHandler.setActivePower(enumName);
      } else {
        inputHandler.setActivePower(null);
      }
    }
  }

  private onBrushSizeChange(size: number): void {
    const inputHandler = this.getInputHandler();
    if (inputHandler) {
      inputHandler.setBrushSize(size);
    }
  }

  private getECSWorld() {
    const gameScene = this.scene.get('Game') as unknown as {
      ecsHost?: { world: import('@/game/ecs/ECSHost.js').GameWorld };
    };
    return gameScene.ecsHost?.world ?? null;
  }

  private getTileMap(): import('@/world/TileMap.js').TileMap {
    const gameScene = this.scene.get('Game') as unknown as {
      tileMap: import('@/world/TileMap.js').TileMap;
    };
    return gameScene.tileMap;
  }

  private getSpritesMap(): Map<number, Phaser.GameObjects.Sprite> | null {
    const gameScene = this.scene.get('Game') as unknown as {
      sprites: Map<number, Phaser.GameObjects.Sprite>;
    };
    return gameScene.sprites ?? null;
  }

  private getInputHandler(): import('@/game/input/InputHandler.js').InputHandler | null {
    const gameScene = this.scene.get('Game') as unknown as {
      inputHandler: import('@/game/input/InputHandler.js').InputHandler | null;
    };
    return gameScene.inputHandler ?? null;
  }

  /** Get the GameScene as a Phaser.Scene (for input access). */
  private getGameSceneObject(): Phaser.Scene | null {
    const scene = this.scene.get('Game');
    if (!scene) return null;
    return scene as unknown as Phaser.Scene;
  }

  /** Check if Shift key is currently held. Uses GameScene keyboard. */
  private isShiftDown(): boolean {
    const gameScene = this.getGameSceneObject();
    if (!gameScene || !gameScene.input.keyboard) return false;
    const shiftKey = gameScene.input.keyboard.addKey('SHIFT');
    return shiftKey.isDown;
  }

  private handleResize(width: number, height: number): void {
    // Reposition time controls
    if (this.timeControls) {
      this.timeControls.destroy();
      this.timeControls = new TimeControls(this, width / 2, 22, (multiplier: number) =>
        this.onSpeedChange(multiplier),
      );
    }

    // Reposition minimap
    if (this.minimap) {
      this.minimap.setPosition(10, height - 194);
    }

    // Reposition entity info panel
    if (this.entityInfoPanel) {
      this.entityInfoPanel.setPosition(width - PANEL_WIDTH - 10, height / 2 - 130);
    }

    // Reposition brush selector
    if (this.brushSelector) {
      this.brushSelector.destroy();
      this.brushSelector = new BrushSizeSelector(
        this,
        width / 2 + 160,
        height - 26,
        (size: number) => this.onBrushSizeChange(size),
      );
    }

    // Reposition save panel
    if (this.saveContainer) {
      this.saveContainer.setPosition(width - 60, 10);
    }

    // Reposition sound toggle
    if (this.soundButton) {
      this.soundButton.setPosition(width - 33, 142);
    }

    // Reposition day/time display
    if (this.dayTimeText) {
      this.dayTimeText.setPosition(width / 2 + 90, 22);
    }

    // Reposition save notification
    if (this.saveNotification) {
      this.saveNotification.setPosition(width / 2, 70);
    }
  }

  update(_time: number, delta: number): void {
    const world = this.getECSWorld();
    const gameScene = this.scene.get('Game');
    const camera = gameScene.cameras.main;
    const pointer = gameScene.input.activePointer;

    // 1. Update time controls (time display)
    if (this.timeControls) {
      this.timeControls.update(delta);
    }

    // 2. Update top bar (entity count)
    if (this.topBar && world) {
      this.topBar.update(world);
    }

    // 3. Update minimap (viewport + creatures)
    if (this.minimap && world) {
      this.minimap.update(camera, world);
    }

    // 4. Update entity info panel (if entity selected)
    if (this.entityInfoPanel && world) {
      this.entityInfoPanel.update(world);
    }

    // 5. Update FPS counter
    if (this.fpsText) {
      const fps = this.game.loop.actualFps;
      this.fpsText.setText(`FPS: ${Math.round(fps)}`);
    }

    // ── Wave 8: Update selection highlights ─────────────────────────
    this.dragSelect.updateSelectionHighlights(world, this.getSpritesMap());

    // ── Wave 8: Update tooltip ──────────────────────────────────────
    this.tooltip.update(world, pointer);

    // ── Wave 7: Day/Time display ─────────────────────────────────────
    this.updateDayTimeDisplay();

    // ── Wave 7: Save notification timeout ────────────────────────────
    if (this.saveNotifyTimer > 0) {
      this.saveNotifyTimer -= delta;
      if (this.saveNotifyTimer <= 0 && this.saveNotification) {
        this.saveNotification.setVisible(false);
      }
    }

    // ── Wave 19: Update damage numbers & notifications ────────────────
    if (this.damageNumbers) this.damageNumbers.update();
    if (this.notificationSystem) this.notificationSystem.update();
    if (this.debugOverlay) this.debugOverlay.update();
  }

  /** Get the DamageNumbers instance (for external systems to spawn damage text). */
  getDamageNumbers(): DamageNumbers | null {
    return this.damageNumbers;
  }

  private updateDayTimeDisplay(): void {
    if (!this.dayTimeText) return;

    const gameScene = this.getGameScene();
    if (!gameScene) return;

    const cycle = gameScene.getDayNightCycle();
    if (!cycle) return;

    const hour = cycle.getHour();
    const phase = cycle.getTimeOfDay();
    const hourStr = Math.floor(hour).toString().padStart(2, '0');
    const minStr = Math.floor((hour % 1) * 60)
      .toString()
      .padStart(2, '0');

    const phaseIcons: Record<string, string> = {
      dawn: '🌅',
      day: '☀️',
      dusk: '🌇',
      night: '🌙',
    };

    this.dayTimeText.setText(
      `${phaseIcons[phase] ?? ''} ${hourStr}:${minStr} ${phase.toUpperCase()}`,
    );
  }
}
