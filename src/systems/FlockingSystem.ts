/**
 * FlockingSystem - Orchestrates boid physics simulation.
 *
 * This system coordinates:
 * - Spatial hashing for neighbor queries
 * - Physics calculations for all boids
 * - Boid lifecycle (creation, destruction, reset)
 *
 * Performance optimizations:
 * - O(1) neighbor queries via spatial hashing
 * - O(n) iteration instead of O(n²) pairwise checks
 * - Simple loops instead of map().reduce() for counting
 * - Pooled arrays in BoidEntity for neighbor caching
 */

import { BoidEntity } from '../entities/BoidEntity.js';
import { BoidPhysics, type PhysicsContext } from '../physics/BoidPhysics.js';
import { SpatialHash } from '../spatial/SpatialHash.js';
import type { SimulationConfig, PhysicsSettings } from '../core/types.js';

/**
 * Manages the flock of boids and their physics simulation.
 */
export class FlockingSystem {
	/** All boids in the simulation */
	private readonly boids: BoidEntity[] = [];

	/** Spatial hash for neighbor queries */
	private readonly spatialHash: SpatialHash<BoidEntity>;

	/** Current world dimensions */
	private width: number;
	private height: number;

	/**
	 * Creates a new flocking system.
	 * @param initialCount - Initial number of boids
	 * @param width - World width
	 * @param height - World height
	 * @param vision - Initial vision radius for spatial hash cell size
	 */
	public constructor(initialCount: number, width: number, height: number, vision: number) {
		this.width = width;
		this.height = height;
		this.spatialHash = new SpatialHash(vision, width, height);

		// Create initial boids
		this.resize(initialCount, 1, 4); // Default min/max speed
	}

	// ==========================================================================
	// Lifecycle Methods
	// ==========================================================================

	/**
	 * Resizes the flock to the target count.
	 * Reuses existing boids when possible.
	 */
	public resize(targetCount: number, minSpeed: number, maxSpeed: number): void {
		const currentCount = this.boids.length;

		if (targetCount < currentCount) {
			// Remove excess boids
			this.boids.length = targetCount;
		} else if (targetCount > currentCount) {
			// Add new boids
			for (let i = currentCount; i < targetCount; i++) {
				const boid = BoidEntity.createRandom(i, this.width, this.height, minSpeed, maxSpeed);
				this.boids.push(boid);
			}
		}
	}

	/**
	 * Resets all boids to random positions and velocities.
	 */
	public reset(minSpeed: number, maxSpeed: number): void {
		const count = this.boids.length;
		this.boids.length = 0;
		this.resize(count, minSpeed, maxSpeed);
	}

	/**
	 * Updates world dimensions.
	 */
	public setWorldSize(width: number, height: number): void {
		this.width = width;
		this.height = height;
	}

	// ==========================================================================
	// Update Methods
	// ==========================================================================

	/**
	 * Runs one simulation step.
	 * @param config - Current simulation configuration
	 * @param ctx - Physics context with runtime state
	 */
	public update(config: SimulationConfig, ctx: PhysicsContext): void {
		// Update spatial hash dimensions if needed
		this.spatialHash.resize(config.vision, this.width, this.height);

		// Phase 1: Update positions from previous frame's acceleration
		for (const boid of this.boids) {
			BoidPhysics.integrate(boid, config, ctx);
		}

		// Phase 2: Rebuild spatial hash and calculate new accelerations
		if (!config.particle && config.vision > 0) {
			this.rebuildSpatialHash();
			this.calculateFlocking(config, ctx.sqVis);
		}

		// Phase 3: Apply interaction forces (mouse, explosions)
		for (const boid of this.boids) {
			BoidPhysics.applyInteraction(boid, config, ctx);
		}
	}

	/**
	 * Rebuilds the spatial hash with current boid positions.
	 * O(n) where n is the number of boids.
	 */
	private rebuildSpatialHash(): void {
		this.spatialHash.clear();
		this.spatialHash.insertAll(this.boids);
	}

	/**
	 * Calculates flocking forces for all boids.
	 * Uses spatial hashing for O(n) instead of O(n²).
	 */
	private calculateFlocking(config: PhysicsSettings, sqVis: number): void {
		for (const boid of this.boids) {
			// Clear neighbor cache from previous frame
			boid.clearNeighborCache();

			// Get candidate neighbors from spatial hash
			const candidates = this.spatialHash.queryNearby(boid.x, boid.y);

			// Count total candidates using simple loop (O(k) where k = cells)
			// This replaces the original map().reduce() pattern
			let candidateCount = 0;
			for (const cell of candidates) {
				candidateCount += cell.length;
			}

			// Calculate step size for accuracy limiting
			const step = config.accuracy === 0 ? 1 : Math.ceil(candidateCount / config.accuracy);

			// Random offset for fairness when stepping
			let globalIndex = Math.floor(Math.random() * step);

			// Find actual neighbors within vision radius
			for (const cell of candidates) {
				for (; globalIndex < cell.length; globalIndex += step) {
					const other = cell[globalIndex];
					if (other === undefined || other === boid) continue;

					const sqrDist = boid.sqrDist(other);
					if (sqrDist < sqVis) {
						boid.addNeighbor(other, sqrDist);
					}
				}
				globalIndex -= cell.length;
			}

			// Apply flocking forces based on neighbors
			BoidPhysics.applyFlocking(boid, config);
		}
	}

	// ==========================================================================
	// Getters
	// ==========================================================================

	/**
	 * Gets all boids (read-only).
	 */
	public getBoids(): readonly BoidEntity[] {
		return this.boids;
	}

	/**
	 * Gets the current boid count.
	 */
	public get count(): number {
		return this.boids.length;
	}

	/**
	 * Gets the spatial hash for grid visualization.
	 */
	public getSpatialHash(): SpatialHash<BoidEntity> {
		return this.spatialHash;
	}
}

