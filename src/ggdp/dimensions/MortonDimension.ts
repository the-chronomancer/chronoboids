/**
 * MortonDimension - Cache-coherent iteration via Morton codes (Z-order curves).
 *
 * Morton codes interleave the bits of X and Y coordinates, creating a
 * space-filling curve that preserves spatial locality. This means boids
 * that are spatially close are also close in memory, improving cache hits.
 *
 * When enabled: Iterates buckets in Morton order
 * When disabled: Standard row-major iteration
 */

import { performanceMetrics } from '../metrics/PerformanceMetrics.js';

/**
 * Lookup tables for fast Morton encoding.
 * Pre-computed bit interleaving for values 0-255.
 */
const MORTON_X_TABLE = new Uint32Array(256);
const MORTON_Y_TABLE = new Uint32Array(256);

// Initialize lookup tables
for (let i = 0; i < 256; i++) {
	let x = i;
	let y = i;

	// Spread bits for X (goes into even positions)
	x = (x | (x << 4)) & 0x0f0f;
	x = (x | (x << 2)) & 0x3333;
	x = (x | (x << 1)) & 0x5555;
	MORTON_X_TABLE[i] = x;

	// Spread bits for Y (goes into odd positions)
	y = (y | (y << 4)) & 0x0f0f;
	y = (y | (y << 2)) & 0x3333;
	y = (y | (y << 1)) & 0x5555;
	MORTON_Y_TABLE[i] = y << 1;
}

/**
 * Encodes a 2D coordinate into a Morton code (Z-order value).
 * Supports coordinates up to 65535 (16 bits each).
 *
 * @param x - X coordinate (0-65535)
 * @param y - Y coordinate (0-65535)
 * @returns 32-bit Morton code
 */
export function mortonEncode(x: number, y: number): number {
	// Use lookup tables for lower 8 bits, manual for upper 8 bits
	const xLow = MORTON_X_TABLE[x & 0xff]!;
	const xHigh = MORTON_X_TABLE[(x >> 8) & 0xff]!;
	const yLow = MORTON_Y_TABLE[y & 0xff]!;
	const yHigh = MORTON_Y_TABLE[(y >> 8) & 0xff]!;

	return (xHigh << 16) | (yHigh << 16) | xLow | yLow;
}

/**
 * Decodes a Morton code back to 2D coordinates.
 *
 * @param code - 32-bit Morton code
 * @returns [x, y] coordinates
 */
export function mortonDecode(code: number): [number, number] {
	let x = code & 0x55555555;
	let y = (code >> 1) & 0x55555555;

	// Compact bits for X
	x = (x | (x >> 1)) & 0x33333333;
	x = (x | (x >> 2)) & 0x0f0f0f0f;
	x = (x | (x >> 4)) & 0x00ff00ff;
	x = (x | (x >> 8)) & 0x0000ffff;

	// Compact bits for Y
	y = (y | (y >> 1)) & 0x33333333;
	y = (y | (y >> 2)) & 0x0f0f0f0f;
	y = (y | (y >> 4)) & 0x00ff00ff;
	y = (y | (y >> 8)) & 0x0000ffff;

	return [x, y];
}

/**
 * Pre-computed Morton-ordered indices for a grid.
 */
export class MortonOrderedIndices {
	/** Array of [row, col] pairs in Morton order */
	private indices: [number, number][] = [];

	/** Grid dimensions */
	private rows = 0;
	private cols = 0;

	/**
	 * Rebuilds the Morton-ordered index list for a grid.
	 */
	public rebuild(rows: number, cols: number): void {
		if (this.rows === rows && this.cols === cols) {
			return; // No change needed
		}

		this.rows = rows;
		this.cols = cols;
		this.indices = [];

		// Generate all cell coordinates with their Morton codes
		const cells: { row: number; col: number; morton: number }[] = [];

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				cells.push({
					row,
					col,
					morton: mortonEncode(col, row),
				});
			}
		}

		// Sort by Morton code
		cells.sort((a, b) => a.morton - b.morton);

		// Extract just the indices
		this.indices = cells.map((c) => [c.row, c.col]);
	}

	/**
	 * Gets the Morton-ordered indices.
	 */
	public getIndices(): readonly [number, number][] {
		return this.indices;
	}

	/**
	 * Gets the number of cells.
	 */
	public get length(): number {
		return this.indices.length;
	}
}

/**
 * Provides Morton-ordered iteration with toggle support.
 */
export class MortonDimension {
	/** Pre-computed Morton order */
	private readonly mortonIndices = new MortonOrderedIndices();

	/** Whether Morton ordering is enabled */
	private _enabled = false;

	/** Cache hit improvement estimate */
	private _cacheImprovement = 0;

	/**
	 * Whether Morton ordering is enabled.
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(value: boolean) {
		this._enabled = value;
	}

	/**
	 * Updates the Morton order for a new grid size.
	 */
	public updateGridSize(rows: number, cols: number): void {
		if (this._enabled) {
			performanceMetrics.startMeasure('morton');
			this.mortonIndices.rebuild(rows, cols);
			performanceMetrics.endMeasure('morton');
		}
	}

	/**
	 * Gets iteration indices for grid cells.
	 *
	 * When enabled: Returns Morton-ordered [row, col] pairs
	 * When disabled: Returns null (use standard row-major iteration)
	 */
	public getIterationOrder(): readonly [number, number][] | null {
		if (!this._enabled) {
			return null;
		}
		return this.mortonIndices.getIndices();
	}

	/**
	 * Iterates over cells in Morton order, calling callback for each.
	 * Falls back to row-major if disabled.
	 *
	 * @param rows - Number of rows
	 * @param cols - Number of columns
	 * @param callback - Function to call for each cell
	 */
	public iterate(
		rows: number,
		cols: number,
		callback: (row: number, col: number) => void
	): void {
		if (this._enabled) {
			const indices = this.mortonIndices.getIndices();
			for (const [row, col] of indices) {
				callback(row, col);
			}
		} else {
			// Standard row-major iteration
			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					callback(row, col);
				}
			}
		}
	}

	/**
	 * Estimates cache improvement from Morton ordering.
	 * This is a rough estimate based on spatial locality preservation.
	 */
	public estimateCacheImprovement(rows: number, cols: number): number {
		if (!this._enabled || rows * cols < 16) {
			this._cacheImprovement = 0;
			return 0;
		}

		// Morton ordering typically provides 20-50% improvement for clustered data
		// The improvement scales with grid size
		const gridSize = rows * cols;
		const logSize = Math.log2(gridSize);
		this._cacheImprovement = Math.min(50, 10 + logSize * 3);

		return this._cacheImprovement;
	}

	/**
	 * Updates the impact metric.
	 */
	public updateMetrics(rows: number, cols: number): void {
		if (this._enabled) {
			const improvement = this.estimateCacheImprovement(rows, cols);
			performanceMetrics.setImpact('morton', `~${improvement.toFixed(0)}% cache↑`, improvement);
		} else {
			performanceMetrics.setImpact('morton', '--', 0);
		}
	}

	/**
	 * Resets the dimension state.
	 */
	public reset(): void {
		this._cacheImprovement = 0;
	}
}

/**
 * Singleton instance.
 */
export const mortonDimension = new MortonDimension();

