/**
 * FlowDimension - Flow fields for environmental forces.
 *
 * Environmental forces (wind, currents, thermals) exist as vector fields
 * in space. Sampling a field is O(1), regardless of how many force sources.
 *
 * When enabled: Boids sample flow field for environmental forces
 * When disabled: No environmental forces
 */

import { V2D } from '../../math/V2D.js';
import { performanceMetrics } from '../metrics/PerformanceMetrics.js';

/**
 * A 2D grid of force vectors.
 */
export class FlowField {
	/** Grid of force vectors */
	private readonly field: V2D[][];

	/** Cell size in world units */
	private readonly cellSize: number;

	/** Grid dimensions */
	private readonly cols: number;
	private readonly rows: number;

	/** World dimensions (stored for reference) */
	public readonly worldWidth: number;
	public readonly worldHeight: number;

	/**
	 * Creates a new FlowField.
	 */
	public constructor(cellSize: number, width: number, height: number) {
		this.cellSize = cellSize;
		this.worldWidth = width;
		this.worldHeight = height;
		this.cols = Math.ceil(width / cellSize);
		this.rows = Math.ceil(height / cellSize);

		// Initialize grid with zero vectors
		this.field = [];
		for (let row = 0; row < this.rows; row++) {
			const rowArray: V2D[] = [];
			for (let col = 0; col < this.cols; col++) {
				rowArray.push(new V2D(0, 0));
			}
			this.field.push(rowArray);
		}
	}

	/**
	 * Clears all forces in the field.
	 */
	public clear(): void {
		for (let row = 0; row < this.rows; row++) {
			for (let col = 0; col < this.cols; col++) {
				this.field[row]![col]!.zero();
			}
		}
	}

	/**
	 * Samples the flow field at a position. O(1) lookup.
	 *
	 * @param x - World X position
	 * @param y - World Y position
	 * @returns Force vector at that position
	 */
	public sample(x: number, y: number): V2D {
		const col = Math.floor(x / this.cellSize);
		const row = Math.floor(y / this.cellSize);

		// Clamp to grid bounds
		const clampedCol = Math.max(0, Math.min(this.cols - 1, col));
		const clampedRow = Math.max(0, Math.min(this.rows - 1, row));

		return this.field[clampedRow]![clampedCol]!;
	}

	/**
	 * Samples with bilinear interpolation for smoother results.
	 */
	public sampleSmooth(x: number, y: number): V2D {
		const fx = x / this.cellSize;
		const fy = y / this.cellSize;

		const col = Math.floor(fx);
		const row = Math.floor(fy);

		// Fractional parts for interpolation
		const tx = fx - col;
		const ty = fy - row;

		// Get four corners
		const c00 = this.getCell(row, col);
		const c10 = this.getCell(row, col + 1);
		const c01 = this.getCell(row + 1, col);
		const c11 = this.getCell(row + 1, col + 1);

		// Bilinear interpolation
		const result = new V2D(
			(1 - tx) * (1 - ty) * c00.x +
				tx * (1 - ty) * c10.x +
				(1 - tx) * ty * c01.x +
				tx * ty * c11.x,
			(1 - tx) * (1 - ty) * c00.y +
				tx * (1 - ty) * c10.y +
				(1 - tx) * ty * c01.y +
				tx * ty * c11.y
		);

		return result;
	}

	/**
	 * Gets a cell with bounds checking.
	 */
	private getCell(row: number, col: number): V2D {
		const clampedCol = Math.max(0, Math.min(this.cols - 1, col));
		const clampedRow = Math.max(0, Math.min(this.rows - 1, row));
		return this.field[clampedRow]![clampedCol]!;
	}

	/**
	 * Adds uniform wind across the entire field.
	 */
	public addWind(direction: number, strength: number): void {
		const windX = Math.cos(direction) * strength;
		const windY = Math.sin(direction) * strength;

		for (let row = 0; row < this.rows; row++) {
			for (let col = 0; col < this.cols; col++) {
				this.field[row]![col]!.x += windX;
				this.field[row]![col]!.y += windY;
			}
		}
	}

	/**
	 * Adds a thermal (circular upward flow with inward spiral).
	 */
	public addThermal(centerX: number, centerY: number, radius: number, strength: number): void {
		const centerCol = Math.floor(centerX / this.cellSize);
		const centerRow = Math.floor(centerY / this.cellSize);
		const cellRadius = Math.ceil(radius / this.cellSize);

		for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
			for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
				if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) continue;

				const dx = (col - centerCol) * this.cellSize;
				const dy = (row - centerRow) * this.cellSize;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < radius) {
					const factor = 1 - dist / radius;
					// Upward force (negative Y in screen coords) + slight inward spiral
					this.field[row]![col]!.y -= strength * factor;
					// Spiral: perpendicular to radius
					this.field[row]![col]!.x += (dy / (radius + 1)) * strength * factor * 0.3;
				}
			}
		}
	}

	/**
	 * Adds Perlin-like noise turbulence.
	 */
	public addTurbulence(strength: number, scale = 0.01): void {
		for (let row = 0; row < this.rows; row++) {
			for (let col = 0; col < this.cols; col++) {
				// Simple noise approximation using sin/cos
				const nx = col * scale * 10;
				const ny = row * scale * 10;
				const angle =
					Math.sin(nx) * Math.cos(ny) * Math.PI * 2 + Math.sin(nx * 0.5 + ny * 0.7) * Math.PI;

				this.field[row]![col]!.x += Math.cos(angle) * strength;
				this.field[row]![col]!.y += Math.sin(angle) * strength;
			}
		}
	}

	/**
	 * Adds a vortex (rotating flow).
	 */
	public addVortex(
		centerX: number,
		centerY: number,
		radius: number,
		strength: number,
		clockwise = true
	): void {
		const centerCol = Math.floor(centerX / this.cellSize);
		const centerRow = Math.floor(centerY / this.cellSize);
		const cellRadius = Math.ceil(radius / this.cellSize);
		const sign = clockwise ? 1 : -1;

		for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
			for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
				if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) continue;

				const dx = (col - centerCol) * this.cellSize;
				const dy = (row - centerRow) * this.cellSize;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < radius && dist > 0) {
					const factor = 1 - dist / radius;
					// Perpendicular to radius (tangent)
					const nx = -dy / dist;
					const ny = dx / dist;
					this.field[row]![col]!.x += nx * strength * factor * sign;
					this.field[row]![col]!.y += ny * strength * factor * sign;
				}
			}
		}
	}

	/**
	 * Gets grid dimensions for visualization.
	 */
	public get gridCols(): number {
		return this.cols;
	}

	public get gridRows(): number {
		return this.rows;
	}

	public get gridCellSize(): number {
		return this.cellSize;
	}

	/**
	 * Gets the force at a specific cell (for visualization).
	 */
	public getCellForce(row: number, col: number): V2D | null {
		if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
			return null;
		}
		return this.field[row]![col]!;
	}
}

/**
 * Provides flow field forces with toggle support.
 */
export class FlowDimension {
	/** The flow field */
	private flowField: FlowField | null = null;

	/** Whether flow field is enabled */
	private _enabled = false;

	/** Force strength multiplier */
	private _strength = 0.1;

	/** Wind settings */
	private _windDirection = 0;
	private _windStrength = 0;

	/** Turbulence settings */
	private _turbulence = false;
	private _turbulenceStrength = 0.05;

	/** Track samples for metrics */
	private _sampleCount = 0;

	/**
	 * Whether flow field is enabled.
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(value: boolean) {
		this._enabled = value;
	}

	/**
	 * Gets/sets the force strength multiplier.
	 */
	public get strength(): number {
		return this._strength;
	}

	public set strength(value: number) {
		this._strength = Math.max(0, value);
	}

	/**
	 * Gets the flow field (may be null if not initialized).
	 */
	public getFlowField(): FlowField | null {
		return this.flowField;
	}

	/**
	 * Initializes or resizes the flow field.
	 */
	public initialize(width: number, height: number, cellSize = 50): void {
		this.flowField = new FlowField(cellSize, width, height);
		this.rebuildField();
	}

	/**
	 * Rebuilds the flow field with current settings.
	 */
	public rebuildField(): void {
		if (this.flowField === null) return;

		performanceMetrics.startMeasure('flow');

		this.flowField.clear();

		// Add wind if configured
		if (this._windStrength > 0) {
			this.flowField.addWind(this._windDirection, this._windStrength);
		}

		// Add turbulence if enabled
		if (this._turbulence) {
			this.flowField.addTurbulence(this._turbulenceStrength);
		}

		performanceMetrics.endMeasure('flow');
	}

	/**
	 * Sets wind parameters.
	 */
	public setWind(direction: number, strength: number): void {
		this._windDirection = direction;
		this._windStrength = strength;
		this.rebuildField();
	}

	/**
	 * Sets turbulence parameters.
	 */
	public setTurbulence(enabled: boolean, strength = 0.05): void {
		this._turbulence = enabled;
		this._turbulenceStrength = strength;
		this.rebuildField();
	}

	/**
	 * Adds a thermal to the field.
	 */
	public addThermal(x: number, y: number, radius: number, strength: number): void {
		if (this.flowField !== null) {
			this.flowField.addThermal(x, y, radius, strength);
		}
	}

	/**
	 * Adds a vortex to the field.
	 */
	public addVortex(x: number, y: number, radius: number, strength: number, clockwise = true): void {
		if (this.flowField !== null) {
			this.flowField.addVortex(x, y, radius, strength, clockwise);
		}
	}

	/**
	 * Resets per-frame counters.
	 */
	public beginFrame(): void {
		this._sampleCount = 0;
	}

	/**
	 * Samples the flow field at a position.
	 *
	 * When enabled: Returns force vector scaled by strength
	 * When disabled: Returns zero vector
	 */
	public sample(x: number, y: number): V2D {
		this._sampleCount++;

		if (!this._enabled || this.flowField === null) {
			return new V2D(0, 0);
		}

		const force = this.flowField.sample(x, y);
		return new V2D(force.x * this._strength, force.y * this._strength);
	}

	/**
	 * Samples and adds force directly to a vector (avoids allocation).
	 */
	public applyToAcceleration(x: number, y: number, acceleration: V2D): void {
		this._sampleCount++;

		if (!this._enabled || this.flowField === null) return;

		const force = this.flowField.sample(x, y);
		acceleration.x += force.x * this._strength;
		acceleration.y += force.y * this._strength;
	}

	/**
	 * Updates the impact metric.
	 */
	public updateMetrics(): void {
		if (this._enabled) {
			performanceMetrics.setImpact('flow', `${this._sampleCount} O(1)`, this._sampleCount);
		} else {
			performanceMetrics.setImpact('flow', '--', 0);
		}
	}

	/**
	 * Gets statistics for this frame.
	 */
	public getStats(): { samples: number; hasWind: boolean; hasTurbulence: boolean } {
		return {
			samples: this._sampleCount,
			hasWind: this._windStrength > 0,
			hasTurbulence: this._turbulence,
		};
	}

	/**
	 * Resets the dimension state.
	 */
	public reset(): void {
		this._sampleCount = 0;
		if (this.flowField !== null) {
			this.flowField.clear();
		}
	}
}

/**
 * Singleton instance.
 */
export const flowDimension = new FlowDimension();

