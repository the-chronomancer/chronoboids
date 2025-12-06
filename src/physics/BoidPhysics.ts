/**
 * BoidPhysics - Functions for boid physics calculations.
 *
 * Following the Single Responsibility Principle, this module handles
 * only physics calculations. It operates on BoidEntity data without
 * knowing about rendering or spatial partitioning.
 *
 * All functions are pure (no side effects except on passed entities).
 */

import { v2dPool } from '../math/V2DPool.js';
import type { BoidEntity } from '../entities/BoidEntity.js';
import type { PhysicsSettings, InputState, IVector2D } from '../core/types.js';

/**
 * Runtime state needed for physics calculations.
 */
export interface PhysicsContext {
	/** Frame delta time */
	readonly delta: number;
	/** Squared vision radius */
	readonly sqVis: number;
	/** Computed noise range in radians */
	readonly noiseRange: number;
	/** Mouse force magnitude */
	readonly mouseForce: number;
	/** World width */
	readonly width: number;
	/** World height */
	readonly height: number;
	/** Mouse input state */
	readonly mouse: InputState;
	/** Explosion state */
	readonly explosion: {
		readonly intensity: number;
		readonly position: IVector2D;
	};
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Clamps a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
	if (value <= min) return min;
	if (value >= max) return max;
	return value;
}

/**
 * Handles world boundary collisions or wrapping.
 */
function handleBoundaries(
	boid: BoidEntity,
	settings: PhysicsSettings,
	width: number,
	height: number
): void {
	if (settings.bounce) {
		// Bounce off edges
		let bounced = false;

		if (boid.x < 0 || boid.x > width) {
			boid.velocity.x *= -1;
			bounced = true;
		}
		if (boid.y < 0 || boid.y > height) {
			boid.velocity.y *= -1;
			bounced = true;
		}

		if (bounced) {
			boid.x = clamp(boid.x, 0, width);
			boid.y = clamp(boid.y, 0, height);
		}
	} else {
		// Wrap around edges
		if (boid.x < 0) boid.x = width;
		if (boid.x > width) boid.x = 0;
		if (boid.y < 0) boid.y = height;
		if (boid.y > height) boid.y = 0;
	}
}

// =============================================================================
// Exported Physics Functions
// =============================================================================

/**
 * Calculates and applies flocking forces (alignment, cohesion, separation).
 * Uses the boid's neighbor cache which should be populated before calling.
 *
 * @param boid - The boid to update
 * @param settings - Physics settings
 */
export function applyFlocking(boid: BoidEntity, settings: PhysicsSettings): void {
	boid.resetAcceleration();

	if (settings.particle || settings.vision === 0) {
		return;
	}

	const neighborCount = boid.neighborCount;
	if (neighborCount === 0) {
		return;
	}

	// Use pooled vectors for temporary calculations
	const alignment = v2dPool.get();
	const cohesion = v2dPool.get();
	const separation = v2dPool.get();

	// Calculate flocking forces
	for (let i = 0; i < neighborCount; i++) {
		const neighbor = boid.neighborCache[i];
		const sqrDist = boid.distanceCache[i];

		if (neighbor === undefined || sqrDist === undefined) continue;

		// Alignment: average velocity, weighted by direction similarity
		const bias = settings.bias ** neighbor.velocity.dot(boid.velocity);
		alignment.sclAdd(neighbor.velocity, bias);

		// Cohesion: average position
		cohesion.add(neighbor);

		// Separation: inverse distance weighted
		const invDist = 1 / (sqrDist || 0.00001);
		separation.x += (boid.x - neighbor.x) * invDist;
		separation.y += (boid.y - neighbor.y) * invDist;
	}

	// Normalize and apply steering
	if (neighborCount > 0) {
		// Alignment steering
		alignment.setMag(settings.maxSpeed).sub(boid.velocity).max(settings.maxForce);

		// Cohesion steering
		cohesion
			.div(neighborCount)
			.sub(boid)
			.setMag(settings.maxSpeed)
			.sub(boid.velocity)
			.max(settings.maxForce);

		// Separation steering
		separation.setMag(settings.maxSpeed).sub(boid.velocity).max(settings.maxForce);
	}

	// Apply weighted forces
	boid.applyScaledForce(alignment, settings.alignment);
	boid.applyScaledForce(cohesion, settings.cohesion);
	boid.applyScaledForce(separation, settings.separation);
}

/**
 * Applies mouse and explosion interaction forces.
 *
 * @param boid - The boid to update
 * @param settings - Physics settings
 * @param ctx - Physics context with input state
 */
export function applyInteraction(
	boid: BoidEntity,
	settings: PhysicsSettings,
	ctx: PhysicsContext
): void {
	// Clear acceleration in particle mode
	if (settings.particle || settings.vision === 0) {
		boid.resetAcceleration();
	}

	// Mouse attraction/repulsion
	if (ctx.mouse.down && ctx.mouse.over) {
		const mouseVec = v2dPool.get(ctx.mouse.x, ctx.mouse.y);
		const sqrDist = mouseVec.sqrDist(boid);

		mouseVec
			.sub(boid)
			.setMag(10000 / (sqrDist || 1))
			.max(ctx.mouseForce);

		if (ctx.mouse.button === 0) {
			boid.applyForce(mouseVec);
		} else if (ctx.mouse.button === 2) {
			boid.acceleration.sub(mouseVec);
		}
	}

	// Explosion repulsion
	if (ctx.explosion.intensity > 0.001) {
		const explosionVec = v2dPool.get(ctx.explosion.position.x, ctx.explosion.position.y);
		const sqrDist = explosionVec.sqrDist(boid);

		explosionVec
			.sub(boid)
			.setMag((ctx.explosion.intensity * 100000) / (sqrDist || 1))
			.max(ctx.mouseForce * 3);

		boid.acceleration.sub(explosionVec);
	}
}

/**
 * Integrates velocity and position for a boid.
 *
 * @param boid - The boid to update
 * @param settings - Physics settings
 * @param ctx - Physics context
 */
export function integrate(
	boid: BoidEntity,
	settings: PhysicsSettings,
	ctx: PhysicsContext
): void {
	// Apply acceleration to velocity
	boid.velocity.sclAdd(boid.acceleration, ctx.delta);

	// Apply drag
	if (settings.drag > 0) {
		boid.velocity.mult(1 - settings.drag);
	}

	// Apply noise (random rotation)
	if (settings.noise > 0) {
		const noiseAngle = (Math.random() * 2 - 1) * ctx.noiseRange;
		boid.velocity.rotate(noiseAngle);
	}

	// Enforce minimum speed
	if (settings.minSpeed > 0) {
		const sqrMag = boid.velocity.sqrMag();
		if (sqrMag === 0) {
			boid.velocity.random(settings.minSpeed);
		} else if (sqrMag < settings.minSpeed * settings.minSpeed) {
			boid.velocity.setMag(settings.minSpeed);
		}
	}

	// Enforce maximum speed
	boid.velocity.max(settings.maxSpeed);

	// Update position
	boid.sclAdd(boid.velocity, ctx.delta);

	// Handle boundaries
	handleBoundaries(boid, settings, ctx.width, ctx.height);
}

/**
 * Computes the mouse force based on settings.
 */
export function computeMouseForce(settings: PhysicsSettings): number {
	const force =
		(settings.maxSpeed *
			settings.maxForce *
			(settings.alignment + settings.cohesion + settings.separation + 1)) /
		16;
	return Math.max(force, 0);
}

/**
 * Computes the noise range in radians.
 */
export function computeNoiseRange(noise: number): number {
	return (Math.PI / 80) * noise;
}

/**
 * Namespace export for backwards compatibility.
 */
export const BoidPhysics = {
	applyFlocking,
	applyInteraction,
	integrate,
	computeMouseForce,
	computeNoiseRange,
};
