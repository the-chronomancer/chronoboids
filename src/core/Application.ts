/**
 * Application - Main entry point for the Chronoboids simulation.
 *
 * This class orchestrates all systems and handles the game loop.
 * Uses PIXI.js v8 async initialization pattern.
 */

import { Application as PIXIApplication } from 'pixi.js';
import { V2D } from '../math/V2D.js';
import { v2dPool } from '../math/V2DPool.js';
import { FlockingSystem } from '../systems/FlockingSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { InputSystem } from '../systems/InputSystem.js';
import { configManager } from '../config/SimulationConfig.js';
import { BoidPhysics, type PhysicsContext } from '../physics/BoidPhysics.js';
import { eventBus } from './EventBus.js';
import type { RuntimeState } from './types.js';

/**
 * Main application class for the boids simulation.
 */
export class ChronoBoids {
	/** PIXI Application instance */
	private app: PIXIApplication | null = null;

	/** Systems */
	private flockingSystem: FlockingSystem | null = null;
	private renderSystem: RenderSystem | null = null;
	private inputSystem: InputSystem | null = null;

	/** Runtime state */
	private readonly state: RuntimeState;

	/** FPS tracking */
	private fps = 60;

	/** Whether the app is initialized */
	private initialized = false;

	/**
	 * Creates a new ChronoBoids application.
	 */
	public constructor() {
		this.state = {
			mouseForce: 0,
			sqVis: configManager.vision * configManager.vision,
			delta: 1,
			shapeMode: 0,
			noiseRange: BoidPhysics.computeNoiseRange(configManager.config.noise),
			fps: 60,
			nextFrame: false,
			width: window.innerWidth,
			height: window.innerHeight,
			mouse: {
				x: 0,
				y: 0,
				down: false,
				over: true,
				button: 0,
			},
			explosion: {
				intensity: 0,
				position: new V2D(),
			},
		};
	}

	/**
	 * Initializes the application.
	 * Must be called before start().
	 */
	public async init(): Promise<void> {
		if (this.initialized) {
			console.warn('Application already initialized');
			return;
		}

		// Create PIXI Application with v8 async init
		this.app = new PIXIApplication();

		await this.app.init({
			width: this.state.width,
			height: this.state.height,
			antialias: true,
			backgroundColor: 0x161616,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true,
		});

		// Add canvas to DOM
		document.body.prepend(this.app.canvas);

		// Initialize systems
		this.flockingSystem = new FlockingSystem(
			configManager.boids,
			this.state.width,
			this.state.height,
			configManager.vision
		);

		this.renderSystem = new RenderSystem(this.app.stage);
		this.inputSystem = new InputSystem(this.app.canvas);

		// Setup event listeners
		this.setupEventListeners();

		// Initial render sync
		this.renderSystem.syncRenderers(this.flockingSystem.getBoids());

		this.initialized = true;
	}

	/**
	 * Starts the simulation loop.
	 */
	public start(): void {
		if (!this.initialized || this.app === null) {
			console.error('Application not initialized. Call init() first.');
			return;
		}

		this.app.ticker.add(this.loop.bind(this));
	}

	/**
	 * Stops the simulation loop.
	 */
	public stop(): void {
		if (this.app !== null) {
			this.app.ticker.stop();
		}
	}

	/**
	 * Main game loop.
	 */
	private loop(ticker: { deltaTime: number }): void {
		if (
			this.app === null ||
			this.flockingSystem === null ||
			this.renderSystem === null ||
			this.inputSystem === null
		) {
			return;
		}

		// Reset vector pool at start of frame
		v2dPool.reset();

		const config = configManager.config;
		const delta = ticker.deltaTime;

		// Update state
		this.state.delta = delta;
		this.state.mouseForce = BoidPhysics.computeMouseForce(config);
		this.state.sqVis = config.vision * config.vision;
		this.state.noiseRange = BoidPhysics.computeNoiseRange(config.noise);

		// Copy input state
		const inputState = this.inputSystem.getState();
		this.state.mouse.x = inputState.x;
		this.state.mouse.y = inputState.y;
		this.state.mouse.down = inputState.down;
		this.state.mouse.over = inputState.over;
		this.state.mouse.button = inputState.button;

		// Resize flock if needed
		if (this.flockingSystem.count !== config.boids) {
			this.flockingSystem.resize(config.boids, config.minSpeed, config.maxSpeed);
			this.renderSystem.syncRenderers(this.flockingSystem.getBoids());
		}

		// Physics update
		if (!config.paused || this.state.nextFrame) {
			const ctx: PhysicsContext = {
				delta: this.state.delta,
				sqVis: this.state.sqVis,
				noiseRange: this.state.noiseRange,
				mouseForce: this.state.mouseForce,
				width: this.state.width,
				height: this.state.height,
				mouse: this.state.mouse,
				explosion: this.state.explosion,
			};

			this.flockingSystem.update(config, ctx);
			this.state.nextFrame = false;
		}

		// Render
		this.renderSystem.renderBoids(config, configManager.shapeMode, config.maxSpeed);

		// Update grid visualization
		const spatialHash = this.flockingSystem.getSpatialHash();
		this.renderSystem.updateGrid(
			spatialHash.gridWidth,
			spatialHash.gridHeight,
			spatialHash.gridCellSize,
			config.buckets
		);

		// Update explosion effect
		if (this.state.explosion.intensity > 0.001) {
			this.renderSystem.updateExplosion(
				this.state.explosion.intensity,
				this.state.explosion.position.x,
				this.state.explosion.position.y
			);
			(this.state.explosion as { intensity: number }).intensity *= 0.9;
		} else if (this.state.explosion.intensity !== 0) {
			this.renderSystem.updateExplosion(0, 0, 0);
			(this.state.explosion as { intensity: number }).intensity = 0;
		}

		// FPS tracking (exponential moving average)
		if (config.debug) {
			this.fps = this.fps * 0.9 + (60 / delta) * 0.1;
			this.state.fps = this.fps;

			const fpsElement = document.getElementById('fps');
			if (fpsElement !== null) {
				fpsElement.textContent = this.fps.toFixed(2);
			}
		}
	}

	/**
	 * Sets up event bus listeners.
	 */
	private setupEventListeners(): void {
		// Handle resize
		eventBus.on('simulation:resize', ({ width, height }) => {
			this.state.width = width;
			this.state.height = height;

			if (this.app !== null) {
				this.app.renderer.resize(width, height);
			}

			if (this.flockingSystem !== null) {
				this.flockingSystem.setWorldSize(width, height);
			}
		});

		// Handle double-click explosion
		eventBus.on('input:doubleclick', ({ x, y }) => {
			(this.state.explosion as { intensity: number }).intensity = 1;
			(this.state.explosion.position as V2D).set(x, y);
		});

		// Handle pause toggle
		eventBus.on('ui:togglePause', () => {
			configManager.toggle('paused');
		});

		// Handle menu toggle
		eventBus.on('ui:toggleMenu', () => {
			configManager.toggle('menu');
			const container = document.getElementById('container');
			const toggler = document.getElementById('toggler');
			container?.classList.toggle('hidden', !configManager.config.menu);
			toggler?.classList.toggle('hidden', !configManager.config.menu);
		});

		// Handle keydown for frame advance
		eventBus.on('input:keydown', ({ key }) => {
			if (key === '.' && configManager.paused) {
				this.state.nextFrame = true;
			}
		});

		// Handle simulation reset
		eventBus.on('simulation:reset', () => {
			if (this.flockingSystem !== null) {
				const config = configManager.config;
				this.flockingSystem.reset(config.minSpeed, config.maxSpeed);
				this.renderSystem?.syncRenderers(this.flockingSystem.getBoids());
			}
		});
	}

	/**
	 * Cleans up resources.
	 */
	public destroy(): void {
		this.inputSystem?.destroy();
		this.renderSystem?.destroy();

		if (this.app !== null) {
			this.app.destroy(true);
			this.app = null;
		}

		eventBus.clearAll();
		this.initialized = false;
	}

	/**
	 * Gets the current FPS.
	 */
	public getFps(): number {
		return this.fps;
	}

	/**
	 * Gets whether the app is initialized.
	 */
	public isInitialized(): boolean {
		return this.initialized;
	}
}

