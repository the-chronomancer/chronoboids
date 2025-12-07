/**
 * BoidRenderer - PIXI.js v8 rendering for boids.
 *
 * Following the Single Responsibility Principle, this class handles
 * only visual representation. It reads from BoidEntity but doesn't
 * modify physics state.
 *
 * PIXI.js v8 API changes from v5:
 * - Graphics.beginFill() -> Graphics.fill()
 * - Graphics.lineStyle() -> Graphics.stroke()
 * - Graphics.endFill() is removed
 * - app.view -> app.canvas
 */

import { Graphics, Container } from 'pixi.js';
import type { BoidEntity } from '../entities/BoidEntity.js';
import type { VisualSettings } from '../core/types.js';
import { visualDimension } from '../ggdp/dimensions/VisualDimension.js';

/**
 * Converts HSV color to RGB hex value.
 * @param h - Hue (0-1)
 * @param s - Saturation (0-1)
 * @param v - Value/Brightness (0-1)
 * @returns RGB hex color
 */
function hsvToHex(h: number, s: number, v: number): number {
	let r = 0,
		g = 0,
		b = 0;

	const i = Math.floor(h * 6);
	const f = h * 6 - i;
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);

	switch (i % 6) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = v;
			b = p;
			break;
		case 2:
			r = p;
			g = v;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = v;
			break;
		case 4:
			r = t;
			g = p;
			b = v;
			break;
		case 5:
			r = v;
			g = p;
			b = q;
			break;
	}

	const R = Math.round(r * 255);
	const G = Math.round(g * 255);
	const B = Math.round(b * 255);

	return (R << 16) | (G << 8) | B;
}

/**
 * Visual representation of a single boid.
 */
export class BoidRenderer {
	/** Main shape graphics */
	public readonly shape: Graphics;

	/** Desired direction indicator */
	public readonly desired: Graphics;

	/** Current shape mode for dirty checking */
	private shapeMode = -1;

	/** Reference to the boid entity */
	private readonly entity: BoidEntity;

	/**
	 * Creates a new boid renderer.
	 * @param entity - The boid entity to render
	 * @param stage - The PIXI stage to add graphics to
	 */
	public constructor(entity: BoidEntity, stage: Container) {
		this.entity = entity;

		// Create main shape
		this.shape = new Graphics();
		stage.addChild(this.shape);

		// Create desired direction indicator
		this.desired = new Graphics();
		this.desired.moveTo(0, 0);
		this.desired.lineTo(24, 0);
		this.desired.stroke({ width: 2, color: hsvToHex(0.9, 0.5, 1) });
		this.desired.alpha = 0;
		stage.addChild(this.desired);
	}

	/**
	 * Updates the visual representation.
	 * @param settings - Visual settings
	 * @param globalShapeMode - Current global shape mode for dirty checking
	 * @param maxSpeed - Maximum speed for color calculation
	 */
	public render(settings: VisualSettings, globalShapeMode: number, maxSpeed: number): void {
		// Rebuild shape if mode changed
		if (this.shapeMode !== globalShapeMode) {
			this.rebuildShape(settings);
			this.shapeMode = globalShapeMode;
		}

		// Update position and rotation
		this.shape.x = this.entity.x;
		this.shape.y = this.entity.y;
		this.shape.rotation = this.entity.velocity.angle();

		// Update color based on visual fiber (stress) or speed
		if (visualDimension.enabled) {
			// Use stress-based coloring from visual fiber
			this.shape.tint = visualDimension.getColor(this.entity, maxSpeed);
		} else if (settings.hues) {
			const speedRatio = Math.min(this.entity.velocity.mag() / (maxSpeed * 2), 1);
			this.shape.tint = hsvToHex(speedRatio, 1, 1);
		} else {
			this.shape.tint = 0xffffff;
		}

		// Update desired direction indicator
		if (settings.desired && this.entity.acceleration.sqrMag() > 0.01) {
			this.desired.alpha = 0.5;
			this.desired.x = this.entity.x;
			this.desired.y = this.entity.y;
			this.desired.rotation = this.entity.acceleration.angle();
		} else {
			this.desired.alpha = 0;
		}
	}

	/**
	 * Rebuilds the shape graphics based on current settings.
	 * Uses PIXI.js v8 Graphics API.
	 */
	private rebuildShape(settings: VisualSettings): void {
		this.shape.clear();

		// Draw boid triangle
		if (!settings.hideBoids) {
			this.shape.moveTo(6, 0);
			this.shape.lineTo(-6, -4);
			this.shape.lineTo(-4, 0);
			this.shape.lineTo(-6, 4);
			this.shape.lineTo(6, 0);
			this.shape.fill({ color: 0xffffff });
		}

		// Draw vision area
		if (settings.areas || settings.outlines) {
			const vision = settings.halfAreas ? 12.5 : 25; // Default vision / 2

			this.shape.circle(0, 0, vision);

			if (settings.areas) {
				this.shape.fill({ color: 0xffffff, alpha: 0.03 });
			}

			if (settings.outlines) {
				this.shape.stroke({ width: 0.5, color: 0xffffff, alpha: 0.2 });
			}
		}

		this.shape.alpha = 0.8;
	}

	/**
	 * Updates the vision area size.
	 * @param _vision - New vision radius (used to trigger rebuild)
	 * @param settings - Visual settings
	 */
	public updateVision(_vision: number, settings: VisualSettings): void {
		if (settings.areas || settings.outlines) {
			// Force shape rebuild on next render
			this.shapeMode = -1;
		}
	}

	/**
	 * Cleans up PIXI resources.
	 */
	public destroy(): void {
		this.shape.destroy();
		this.desired.destroy();
	}
}

/**
 * Creates the explosion effect graphics.
 * @returns Graphics object for explosion effect
 */
export function createExplosionGraphics(): Graphics {
	const shape = new Graphics();
	shape.circle(0, 0, 100);
	shape.fill({ color: 0x000000 });
	return shape;
}

/**
 * Creates the spatial grid visualization.
 * @param width - World width
 * @param height - World height
 * @param cellSize - Grid cell size
 * @returns Graphics object for grid
 */
export function createGridGraphics(width: number, height: number, cellSize: number): Graphics {
	const shape = new Graphics();

	const gridWidth = Math.ceil(width / cellSize) * cellSize;
	const gridHeight = Math.ceil(height / cellSize) * cellSize;

	for (let row = 0; row < gridHeight; row += cellSize) {
		for (let col = 0; col < gridWidth; col += cellSize) {
			shape.rect(col, row, cellSize, cellSize);
		}
	}

	shape.stroke({ width: 0.5, color: 0xffffff });
	shape.alpha = 0;

	return shape;
}

