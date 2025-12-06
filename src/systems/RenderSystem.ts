/**
 * RenderSystem - Orchestrates PIXI.js rendering for all boids.
 *
 * Manages:
 * - BoidRenderer instances for each boid
 * - Grid visualization for spatial hash
 * - Explosion effects
 * - FPS display
 */

import { Container, Graphics } from 'pixi.js';
import { BoidRenderer, createExplosionGraphics, createGridGraphics } from '../rendering/BoidRenderer.js';
import type { BoidEntity } from '../entities/BoidEntity.js';
import type { VisualSettings } from '../core/types.js';

/**
 * Manages rendering for the entire simulation.
 */
export class RenderSystem {
	/** PIXI stage container */
	private readonly stage: Container;

	/** Renderers for each boid */
	private readonly renderers: BoidRenderer[] = [];

	/** Grid visualization graphics */
	private gridGraphics: Graphics | null = null;

	/** Explosion effect graphics */
	private readonly explosionGraphics: Graphics;

	/** Current grid dimensions for dirty checking */
	private gridWidth = 0;
	private gridHeight = 0;
	private gridCellSize = 0;

	/**
	 * Creates a new render system.
	 * @param stage - PIXI stage container
	 */
	public constructor(stage: Container) {
		this.stage = stage;
		this.explosionGraphics = createExplosionGraphics();
	}

	// ==========================================================================
	// Boid Renderer Management
	// ==========================================================================

	/**
	 * Syncs renderers with boid entities.
	 * Creates new renderers for new boids, removes unused ones.
	 */
	public syncRenderers(boids: readonly BoidEntity[]): void {
		const targetCount = boids.length;
		const currentCount = this.renderers.length;

		if (targetCount < currentCount) {
			// Remove excess renderers
			for (let i = targetCount; i < currentCount; i++) {
				this.renderers[i]?.destroy();
			}
			this.renderers.length = targetCount;
		} else if (targetCount > currentCount) {
			// Add new renderers
			for (let i = currentCount; i < targetCount; i++) {
				const boid = boids[i];
				if (boid !== undefined) {
					this.renderers.push(new BoidRenderer(boid, this.stage));
				}
			}
		}
	}

	/**
	 * Renders all boids.
	 */
	public renderBoids(settings: VisualSettings, shapeMode: number, maxSpeed: number): void {
		for (const renderer of this.renderers) {
			renderer.render(settings, shapeMode, maxSpeed);
		}
	}

	// ==========================================================================
	// Grid Visualization
	// ==========================================================================

	/**
	 * Updates the grid visualization.
	 * Rebuilds if dimensions changed.
	 */
	public updateGrid(
		width: number,
		height: number,
		cellSize: number,
		showBuckets: boolean
	): void {
		// Check if grid needs rebuilding
		if (
			this.gridGraphics === null ||
			this.gridWidth !== width ||
			this.gridHeight !== height ||
			this.gridCellSize !== cellSize
		) {
			// Remove old grid
			if (this.gridGraphics !== null) {
				this.gridGraphics.destroy();
			}

			// Create new grid
			this.gridGraphics = createGridGraphics(width, height, cellSize);
			this.stage.addChild(this.gridGraphics);

			this.gridWidth = width;
			this.gridHeight = height;
			this.gridCellSize = cellSize;
		}

		// Update visibility
		this.gridGraphics.alpha = showBuckets ? 0.3 : 0;
	}

	// ==========================================================================
	// Explosion Effect
	// ==========================================================================

	/**
	 * Updates the explosion effect.
	 * @param intensity - Current explosion intensity (0-1)
	 * @param x - Explosion X position
	 * @param y - Explosion Y position
	 */
	public updateExplosion(intensity: number, x: number, y: number): void {
		if (intensity === 1) {
			// Start explosion
			this.stage.addChild(this.explosionGraphics);
		}

		if (intensity > 0.001) {
			const scale = Math.sqrt(intensity);
			this.explosionGraphics.alpha = scale;
			this.explosionGraphics.scale.x = scale;
			this.explosionGraphics.scale.y = scale;
			this.explosionGraphics.x = x;
			this.explosionGraphics.y = y;
		} else if (this.explosionGraphics.parent !== null) {
			// Remove explosion when done
			this.stage.removeChild(this.explosionGraphics);
		}
	}

	// ==========================================================================
	// Cleanup
	// ==========================================================================

	/**
	 * Destroys all renderers and graphics.
	 */
	public destroy(): void {
		for (const renderer of this.renderers) {
			renderer.destroy();
		}
		this.renderers.length = 0;

		if (this.gridGraphics !== null) {
			this.gridGraphics.destroy();
			this.gridGraphics = null;
		}

		this.explosionGraphics.destroy();
	}
}

