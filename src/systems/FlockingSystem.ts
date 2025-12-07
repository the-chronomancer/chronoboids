/**
 * FlockingSystem - Orchestrates boid physics simulation with GGDP optimizations.
 *
 * This system coordinates:
 * - Spatial hashing for neighbor queries (toggleable)
 * - Time wheel for staggered updates (toggleable)
 * - Geodesic perception for blind spots (toggleable)
 * - Hyperbolic influence for distance falloff (toggleable)
 * - Flow field for environmental forces (toggleable)
 * - Physics calculations for all boids
 * - Boid lifecycle (creation, destruction, reset)
 *
 * Performance optimizations:
 * - O(1) neighbor queries via spatial hashing
 * - O(n) iteration instead of O(n²) pairwise checks
 * - Simple loops instead of map().reduce() for counting
 * - Pooled arrays in BoidEntity for neighbor caching
 * - Staggered updates via time wheel
 */

import { BoidEntity } from '../entities/BoidEntity.js';
import { BoidPhysics, type PhysicsContext } from '../physics/BoidPhysics.js';
import { SpatialHash } from '../spatial/SpatialHash.js';
import type { SimulationConfig, PhysicsSettings } from '../core/types.js';
import { performanceMetrics } from '../ggdp/metrics/PerformanceMetrics.js';
import { ggdpManager } from '../ggdp/GGDPManager.js';
import { SpatialDimension } from '../ggdp/dimensions/SpatialDimension.js';
import { temporalDimension } from '../ggdp/dimensions/TemporalDimension.js';
import { hierarchicalTemporalDimension } from '../ggdp/dimensions/HierarchicalTemporalDimension.js';
import { mortonDimension, mortonEncode } from '../ggdp/dimensions/MortonDimension.js';
import { perceptualDimension } from '../ggdp/dimensions/PerceptualDimension.js';
import { influenceDimension } from '../ggdp/dimensions/InfluenceDimension.js';
import { flowDimension } from '../ggdp/dimensions/FlowDimension.js';
import { visualDimension } from '../ggdp/dimensions/VisualDimension.js';

/**
 * Manages the flock of boids and their physics simulation.
 */
export class FlockingSystem {
	/** All boids in the simulation */
	private readonly boids: BoidEntity[] = [];

	/** Morton-ordered indices for cache-coherent iteration */
	private mortonOrderedIndices: number[] = [];

	/** GGDP Spatial dimension (wraps spatial hash with toggle) */
	private readonly spatialDimension: SpatialDimension;

	/** Current world dimensions */
	private width: number;
	private height: number;

	/** Track neighbor checks for metrics */
	private neighborChecks = 0;

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
		this.spatialDimension = new SpatialDimension(vision, width, height, true);

		// Initialize flow field
		flowDimension.initialize(width, height, 50);

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

		// Rebuild time wheel if using temporal dimension
		if (temporalDimension.enabled) {
			temporalDimension.rebuild(this.boids);
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

		// Resize flow field if needed
		if (flowDimension.enabled) {
			flowDimension.initialize(width, height, 50);
		}
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
		performanceMetrics.startMeasure('physics');
		this.neighborChecks = 0;

		// Update GGDP dimension states from config
		this.updateDimensionStates(config);

		// Update spatial hash dimensions if needed
		this.spatialDimension.resize(config.vision, this.width, this.height);

		// Reset per-frame dimension counters
		perceptualDimension.beginFrame();
		influenceDimension.beginFrame();
		flowDimension.beginFrame();
		visualDimension.beginFrame();

		// Get boids to update this frame (may be subset if time wheel enabled)
		// Hierarchical time wheel takes priority over basic time wheel
		let boidsToUpdate: readonly BoidEntity[];
		if (hierarchicalTemporalDimension.enabled) {
			boidsToUpdate = hierarchicalTemporalDimension.getActiveBoidsThisFrame(this.boids);
		} else if (temporalDimension.enabled) {
			boidsToUpdate = temporalDimension.getActiveBoidsThisFrame(this.boids);
		} else {
			boidsToUpdate = this.boids;
		}

		// Phase 1: Update positions from previous frame's acceleration
		for (const boid of this.boids) {
			if (hierarchicalTemporalDimension.enabled) {
				// Hierarchical mode: check if boid is in active set
				if (!boidsToUpdate.includes(boid)) {
					hierarchicalTemporalDimension.interpolate(boid, ctx.delta);
				} else {
					BoidPhysics.integrate(boid, config, ctx);
				}
			} else if (temporalDimension.enabled && !temporalDimension.shouldFullUpdate(boid)) {
				// Basic time wheel: interpolate non-active boids
				temporalDimension.interpolate(boid, ctx.delta);
			} else {
				BoidPhysics.integrate(boid, config, ctx);
			}
		}

		// Phase 2: Rebuild spatial hash and calculate new accelerations
		if (!config.particle && config.vision > 0) {
			this.spatialDimension.rebuild(this.boids);

			// Rebuild Morton order if enabled (for cache-coherent iteration)
			if (mortonDimension.enabled) {
				this.rebuildMortonOrder();
			}

			// Calculate flocking with optionally Morton-ordered iteration
			const orderedBoids = mortonDimension.enabled
				? this.getMortonOrderedBoids(boidsToUpdate)
				: boidsToUpdate;
			this.calculateFlocking(config, ctx.sqVis, orderedBoids);
		}

		// Phase 3: Apply interaction forces (mouse, explosions)
		for (const boid of boidsToUpdate) {
			BoidPhysics.applyInteraction(boid, config, ctx);

			// Apply flow field forces
			if (flowDimension.enabled) {
				flowDimension.applyToAcceleration(boid.x, boid.y, boid.acceleration);
			}

			// Update activity tracking for hierarchical time wheel
			if (hierarchicalTemporalDimension.enabled) {
				const velocityMag = Math.sqrt(
					boid.velocity.x * boid.velocity.x + boid.velocity.y * boid.velocity.y
				);
				const nearMouse = ctx.mouse.over && this.isNearPoint(boid, ctx.mouse, 100);
				const nearExplosion = ctx.explosion.intensity > 0 && 
					this.isNearPoint(boid, ctx.explosion.position, 150);
				hierarchicalTemporalDimension.updateBoidActivity(boid, velocityMag, nearMouse, nearExplosion);
			}
		}

		// Phase 4: Compute visual stress if visual fiber enabled
		if (visualDimension.enabled) {
			for (const boid of this.boids) {
				visualDimension.computeStress(
					boid,
					this.width,
					this.height,
					config.maxSpeed,
					ctx.explosion.intensity > 0 ? ctx.explosion.position.x : undefined,
					ctx.explosion.intensity > 0 ? ctx.explosion.position.y : undefined
				);
			}
			visualDimension.batchBoids(this.boids, config.maxSpeed);
		}

		// Update metrics
		const physicsTime = performanceMetrics.endMeasure('physics');
		performanceMetrics.recordPhysicsTime(physicsTime);

		this.spatialDimension.updateMetrics(this.boids.length);
		temporalDimension.updateMetrics(this.boids.length);
		hierarchicalTemporalDimension.updateMetrics(this.boids.length);
		perceptualDimension.updateMetrics();
		influenceDimension.updateMetrics();
		flowDimension.updateMetrics();
		visualDimension.updateMetrics();
	}

	/**
	 * Updates GGDP dimension enabled states from config.
	 */
	private updateDimensionStates(config: SimulationConfig): void {
		// Sync GGDPManager state from config (for dashboard display)
		ggdpManager.syncFromConfig(config);

		this.spatialDimension.enabled = config.spatialHash;

		// Rebuild time wheel when it's toggled on
		// Note: hierarchical time wheel takes priority if both are enabled
		const wasTimeWheelEnabled = temporalDimension.enabled;
		const wasHierarchicalEnabled = hierarchicalTemporalDimension.enabled;

		// Disable basic time wheel if hierarchical is enabled
		temporalDimension.enabled = config.timeWheel && !config.hierarchicalTimeWheel;
		hierarchicalTemporalDimension.enabled = config.hierarchicalTimeWheel;

		if (config.timeWheel && !config.hierarchicalTimeWheel && !wasTimeWheelEnabled) {
			temporalDimension.rebuild(this.boids);
		}

		if (config.hierarchicalTimeWheel && !wasHierarchicalEnabled) {
			hierarchicalTemporalDimension.rebuild(this.boids);
			// Set thresholds from config
			hierarchicalTemporalDimension.setThresholds(
				config.activityThreshold,
				config.activityThreshold * 0.2, // slow threshold = 20% of medium
				30 // demotion delay in frames
			);
		}

		perceptualDimension.enabled = config.geodesicPerception;
		perceptualDimension.blindSpotAngle = (config.blindSpotAngle * Math.PI) / 180;
		influenceDimension.enabled = config.hyperbolicInfluence;
		// Initialize/update flow field when enabled
		const wasFlowEnabled = flowDimension.enabled;
		flowDimension.enabled = config.flowField;
		flowDimension.strength = config.flowStrength;
		if (config.flowField) {
			// Initialize if not done yet
			if (!wasFlowEnabled || flowDimension.getFlowField() === null) {
				flowDimension.initialize(this.width, this.height, 50);
			}
			flowDimension.setWind((config.windDirection * Math.PI) / 180, config.windStrength);
			flowDimension.setTurbulence(config.turbulence, 0.05);
		}

		visualDimension.enabled = config.visualFiber;
		mortonDimension.enabled = config.mortonOrder;
	}

	/**
	 * Rebuilds the Morton-ordered indices for cache-coherent iteration.
	 * Sorts boid indices by their position's Morton code.
	 */
	private rebuildMortonOrder(): void {
		performanceMetrics.startMeasure('morton');

		const cellSize = this.spatialDimension.getCellSize();

		// Ensure array has correct size
		if (this.mortonOrderedIndices.length !== this.boids.length) {
			this.mortonOrderedIndices = new Array(this.boids.length);
		}

		// Compute Morton codes for all boids and sort indices
		const codesAndIndices: { index: number; morton: number }[] = [];
		for (let i = 0; i < this.boids.length; i++) {
			const boid = this.boids[i]!;
			// Convert position to grid cell for Morton code
			const cellX = Math.floor(boid.x / cellSize);
			const cellY = Math.floor(boid.y / cellSize);
			codesAndIndices.push({
				index: i,
				morton: mortonEncode(Math.abs(cellX) & 0xffff, Math.abs(cellY) & 0xffff),
			});
		}

		// Sort by Morton code
		codesAndIndices.sort((a, b) => a.morton - b.morton);

		// Extract sorted indices
		for (let i = 0; i < codesAndIndices.length; i++) {
			this.mortonOrderedIndices[i] = codesAndIndices[i]!.index;
		}

		performanceMetrics.endMeasure('morton');
		mortonDimension.updateMetrics(
			Math.ceil(this.height / cellSize),
			Math.ceil(this.width / cellSize)
		);
	}

	/**
	 * Returns boids in Morton order for cache-coherent iteration.
	 */
	private getMortonOrderedBoids(boidsToUpdate: readonly BoidEntity[]): BoidEntity[] {
		// If updating all boids, use full Morton order
		if (boidsToUpdate === this.boids) {
			const result: BoidEntity[] = [];
			for (const idx of this.mortonOrderedIndices) {
				result.push(this.boids[idx]!);
			}
			return result;
		}

		// If updating subset (time wheel), filter and sort those
		const boidsSet = new Set(boidsToUpdate);
		const filteredIndices = this.mortonOrderedIndices.filter((idx) =>
			boidsSet.has(this.boids[idx]!)
		);
		return filteredIndices.map((idx) => this.boids[idx]!);
	}

	/**
	 * Calculates flocking forces for boids.
	 * Uses spatial hashing for O(n) instead of O(n²).
	 */
	private calculateFlocking(
		config: PhysicsSettings,
		sqVis: number,
		boidsToUpdate: readonly BoidEntity[]
	): void {
		for (const boid of boidsToUpdate) {
			// Clear neighbor cache from previous frame
			boid.clearNeighborCache();

			// Get candidate neighbors (spatial hash or all boids)
			const candidates = this.spatialDimension.getCandidates(boid);

			// Count total candidates
			const candidateCount = this.spatialDimension.countCandidates(candidates);
			this.neighborChecks += candidateCount;

			// For fair GGDP comparison:
			// - Spatial hash ON: Check ALL nearby candidates (O(1) lookup per query - GGDP!)
			// - Spatial hash OFF: Check ALL boids (true O(n²) baseline)
			// The accuracy limiter is a SEPARATE optimization (trades correctness for speed)
			// that can be layered on top later, but shouldn't affect the GGDP comparison
			const effectiveStep = 1; // Always check all candidates for correct flocking

			// Random offset for fairness (not used when step=1)
			let globalIndex = 0;

			// Find actual neighbors within vision radius
			for (const cell of candidates) {
				for (; globalIndex < cell.length; globalIndex += effectiveStep) {
					const other = cell[globalIndex];
					if (other === undefined || other === boid) continue;

					const sqrDist = boid.sqrDist(other);
					if (sqrDist < sqVis) {
						// Apply perceptual filtering (geodesic blind spots)
						let perceptionWeight = 1.0;
						if (perceptualDimension.enabled) {
							perceptionWeight = perceptualDimension.filterNeighbor(boid, other);
							if (perceptionWeight === 0) continue; // In blind spot
						}

						// Apply influence falloff (hyperbolic distance)
						let influenceWeight = 1.0;
						if (influenceDimension.enabled) {
							influenceWeight = influenceDimension.calculateInfluenceFromSqrDist(sqrDist, sqVis);
						}

						// Combine weights and add neighbor with weighted distance
						// Lower weight = acts like further away (reduced influence)
						const combinedWeight = perceptionWeight * influenceWeight;
						const weightedSqrDist = combinedWeight > 0 ? sqrDist / combinedWeight : sqrDist * 10;
						boid.addNeighbor(other, weightedSqrDist);
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
		return this.spatialDimension.getSpatialHash();
	}

	/**
	 * Gets the spatial dimension for GGDP metrics.
	 */
	public getSpatialDimension(): SpatialDimension {
		return this.spatialDimension;
	}

	/**
	 * Gets the neighbor check count for the last frame.
	 */
	public getNeighborChecks(): number {
		return this.neighborChecks;
	}

	/**
	 * Checks if a boid is within a certain distance of a point.
	 */
	private isNearPoint(boid: BoidEntity, point: { x: number; y: number }, radius: number): boolean {
		const dx = boid.x - point.x;
		const dy = boid.y - point.y;
		return dx * dx + dy * dy < radius * radius;
	}
}
