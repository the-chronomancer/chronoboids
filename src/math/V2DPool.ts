/**
 * V2DPool - Object pool for V2D vectors to reduce GC pressure.
 *
 * In a boids simulation, we create many temporary vectors per frame for
 * calculations like alignment, cohesion, and separation. Without pooling,
 * this creates significant garbage collection pressure.
 *
 * Usage:
 * 1. Call pool.reset() at the start of each frame
 * 2. Use pool.get(x, y) instead of new V2D(x, y) for temporary vectors
 * 3. Never store pooled vectors beyond the current frame
 */

import { V2D } from './V2D.js';
import type { IReadonlyVector2D } from '../core/types.js';

/**
 * Pool statistics for debugging and monitoring.
 */
export interface PoolStats {
	/** Total number of vectors in the pool */
	readonly size: number;
	/** Number of vectors used this frame */
	readonly used: number;
	/** Peak usage across all frames */
	readonly peakUsage: number;
	/** Number of times the pool was expanded */
	readonly expansions: number;
}

/**
 * Object pool for V2D vectors.
 * Pre-allocates vectors and reuses them to minimize garbage collection.
 */
export class V2DPool {
	private readonly pool: V2D[];
	private index: number;
	private peakUsage: number;
	private expansions: number;

	/**
	 * Creates a new vector pool.
	 * @param initialSize - Number of vectors to pre-allocate (default 500)
	 */
	public constructor(initialSize = 500) {
		this.pool = new Array<V2D>(initialSize);
		this.index = 0;
		this.peakUsage = 0;
		this.expansions = 0;

		// Pre-allocate vectors
		for (let i = 0; i < initialSize; i++) {
			this.pool[i] = new V2D();
		}
	}

	/**
	 * Gets a vector from the pool, initialized to (x, y).
	 * If the pool is exhausted, it will automatically expand.
	 *
	 * @param x - X component (default 0)
	 * @param y - Y component (default 0)
	 * @returns A vector from the pool
	 */
	public get(x = 0, y = 0): V2D {
		if (this.index >= this.pool.length) {
			// Expand pool by 50%
			this.expand();
		}

		const v = this.pool[this.index++];

		// Type guard - should never happen but satisfies strict null checks
		if (v === undefined) {
			throw new Error('V2DPool: Unexpected undefined vector');
		}

		v.x = x;
		v.y = y;
		return v;
	}

	/**
	 * Gets a vector from the pool, copying values from another vector.
	 *
	 * @param source - Vector to copy from
	 * @returns A vector from the pool with copied values
	 */
	public getFrom(source: IReadonlyVector2D): V2D {
		return this.get(source.x, source.y);
	}

	/**
	 * Resets the pool index for the next frame.
	 * Call this at the start of each frame before any get() calls.
	 *
	 * This is O(1) - we just reset the index, not the vectors.
	 */
	public reset(): void {
		// Track peak usage for monitoring
		if (this.index > this.peakUsage) {
			this.peakUsage = this.index;
		}

		this.index = 0;
	}

	/**
	 * Expands the pool by 50% when exhausted.
	 * This is rare after the first few frames as the pool self-sizes.
	 */
	private expand(): void {
		const newSize = Math.ceil(this.pool.length * 1.5);
		const oldSize = this.pool.length;

		for (let i = oldSize; i < newSize; i++) {
			this.pool.push(new V2D());
		}

		this.expansions++;
	}

	/**
	 * Gets current pool statistics for debugging.
	 */
	public get stats(): PoolStats {
		return {
			size: this.pool.length,
			used: this.index,
			peakUsage: this.peakUsage,
			expansions: this.expansions,
		};
	}

	/**
	 * Pre-warms the pool to a specific size.
	 * Useful if you know you'll need many vectors.
	 *
	 * @param size - Target pool size
	 */
	public prewarm(size: number): void {
		while (this.pool.length < size) {
			this.pool.push(new V2D());
		}
	}
}

/**
 * Global pool instance for the simulation.
 * Reset this at the start of each frame.
 */
export const v2dPool = new V2DPool(500);

