/**
 * BoidEntity - Pure data class for boid state.
 *
 * Following the Single Responsibility Principle, this class only holds data.
 * Physics calculations are in BoidPhysics.ts, rendering in BoidRenderer.ts.
 *
 * This separation allows:
 * - Easy serialization/deserialization
 * - Testing physics without rendering
 * - Potential Web Worker offloading
 * - Clear ownership of concerns
 */

import { V2D } from '../math/V2D.js';
import type { IVector2D, BoidData } from '../core/types.js';

/**
 * Represents a single boid entity with position, velocity, and acceleration.
 * Extends V2D for position to maintain API compatibility with spatial hashing.
 */
export class BoidEntity extends V2D implements BoidData {
	/** Velocity vector */
	public readonly velocity: V2D;

	/** Acceleration vector (reset each frame) */
	public readonly acceleration: V2D;

	/** Unique index in the flock */
	public readonly index: number;

	// ==========================================================================
	// Neighbor Caching (O(1) allocation optimization)
	// ==========================================================================

	/**
	 * Cached array for neighbor references.
	 * Reused each frame to avoid allocations.
	 */
	public readonly neighborCache: BoidEntity[] = [];

	/**
	 * Cached array for squared distances to neighbors.
	 * Parallel array to neighborCache.
	 */
	public readonly distanceCache: number[] = [];

	/**
	 * Number of valid entries in the cache arrays.
	 * We use length tracking instead of resizing arrays.
	 */
	public neighborCount = 0;

	// ==========================================================================
	// Constructor
	// ==========================================================================

	/**
	 * Creates a new boid entity.
	 *
	 * @param index - Unique index in the flock
	 * @param x - Initial X position
	 * @param y - Initial Y position
	 * @param vx - Initial X velocity
	 * @param vy - Initial Y velocity
	 */
	public constructor(index: number, x = 0, y = 0, vx = 0, vy = 0) {
		super(x, y);
		this.index = index;
		this.velocity = new V2D(vx, vy);
		this.acceleration = new V2D(0, 0);
	}

	// ==========================================================================
	// Factory Methods
	// ==========================================================================

	/**
	 * Creates a boid at a random position with random velocity.
	 *
	 * @param index - Unique index in the flock
	 * @param width - World width for random position
	 * @param height - World height for random position
	 * @param minSpeed - Minimum initial speed
	 * @param maxSpeed - Maximum initial speed
	 */
	public static createRandom(
		index: number,
		width: number,
		height: number,
		minSpeed: number,
		maxSpeed: number
	): BoidEntity {
		const x = Math.random() * width;
		const y = Math.random() * height;

		// Random velocity direction and magnitude
		const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
		const angle = Math.random() * Math.PI * 2;
		const vx = Math.cos(angle) * speed;
		const vy = Math.sin(angle) * speed;

		return new BoidEntity(index, x, y, vx, vy);
	}

	// ==========================================================================
	// Neighbor Cache Management
	// ==========================================================================

	/**
	 * Clears the neighbor cache for the next frame.
	 * O(1) operation - just resets the count.
	 */
	public clearNeighborCache(): void {
		this.neighborCount = 0;
	}

	/**
	 * Adds a neighbor to the cache.
	 * Grows the underlying arrays only when needed.
	 *
	 * @param neighbor - The neighboring boid
	 * @param sqrDistance - Squared distance to the neighbor
	 */
	public addNeighbor(neighbor: BoidEntity, sqrDistance: number): void {
		const idx = this.neighborCount;

		// Grow arrays if needed (rare after first few frames)
		if (idx >= this.neighborCache.length) {
			this.neighborCache.push(neighbor);
			this.distanceCache.push(sqrDistance);
		} else {
			this.neighborCache[idx] = neighbor;
			this.distanceCache[idx] = sqrDistance;
		}

		this.neighborCount++;
	}

	/**
	 * Gets a neighbor at the specified index.
	 * Returns undefined if index is out of bounds.
	 */
	public getNeighbor(index: number): BoidEntity | undefined {
		if (index < 0 || index >= this.neighborCount) {
			return undefined;
		}
		return this.neighborCache[index];
	}

	/**
	 * Gets the squared distance to a neighbor at the specified index.
	 * Returns undefined if index is out of bounds.
	 */
	public getNeighborDistance(index: number): number | undefined {
		if (index < 0 || index >= this.neighborCount) {
			return undefined;
		}
		return this.distanceCache[index];
	}

	// ==========================================================================
	// State Management
	// ==========================================================================

	/**
	 * Resets the acceleration for the next frame.
	 */
	public resetAcceleration(): void {
		this.acceleration.zero();
	}

	/**
	 * Applies an impulse to the acceleration.
	 */
	public applyForce(force: IVector2D): void {
		this.acceleration.add(force);
	}

	/**
	 * Applies a scaled impulse to the acceleration.
	 */
	public applyScaledForce(force: IVector2D, scale: number): void {
		this.acceleration.sclAdd(force, scale);
	}

	// ==========================================================================
	// Serialization
	// ==========================================================================

	/**
	 * Converts the boid to a plain object for serialization.
	 */
	public toJSON(): {
		index: number;
		x: number;
		y: number;
		vx: number;
		vy: number;
	} {
		return {
			index: this.index,
			x: this.x,
			y: this.y,
			vx: this.velocity.x,
			vy: this.velocity.y,
		};
	}

	/**
	 * Creates a boid from a serialized object.
	 */
	public static fromJSON(data: {
		index: number;
		x: number;
		y: number;
		vx: number;
		vy: number;
	}): BoidEntity {
		return new BoidEntity(data.index, data.x, data.y, data.vx, data.vy);
	}
}

