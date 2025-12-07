/**
 * InfluenceDimension - Hyperbolic distance falloff for social LOD.
 *
 * In social systems, influence doesn't fall off linearly. Nearby neighbors
 * matter a lot; distant ones barely matter at all. This creates more
 * realistic flocking with tighter sub-groups.
 *
 * When enabled: Uses sigmoid falloff (sharp transition at ~50% distance)
 * When disabled: Linear distance falloff (or no falloff)
 */

import { performanceMetrics } from '../metrics/PerformanceMetrics.js';

/**
 * Hyperbolic space calculations for influence falloff.
 */
export class HyperbolicSpace {
	/**
	 * Converts Euclidean distance to hyperbolic influence using sigmoid.
	 *
	 * The sigmoid creates a sharp transition:
	 * - Close neighbors (< 50% vision): influence ~1.0
	 * - Mid-range (50% vision): influence ~0.5
	 * - Far neighbors (> 50% vision): influence ~0.0
	 *
	 * @param euclideanDist - Actual distance to neighbor
	 * @param maxDist - Maximum distance (vision radius)
	 * @param steepness - How sharp the falloff is (default 8)
	 * @returns Influence value 0-1
	 */
	public static influence(euclideanDist: number, maxDist: number, steepness = 8): number {
		if (maxDist <= 0) return 0;
		const normalized = euclideanDist / maxDist;
		// Sigmoid centered at 0.5
		return 1 / (1 + Math.exp(steepness * (normalized - 0.5)));
	}

	/**
	 * Calculates hyperbolic distance in Poincaré disk model.
	 * Points near the edge appear infinitely far from the center.
	 *
	 * @param x1 - First point X
	 * @param y1 - First point Y
	 * @param x2 - Second point X
	 * @param y2 - Second point Y
	 * @param diskRadius - Radius of the Poincaré disk
	 * @returns Hyperbolic distance (can be infinite)
	 */
	public static hyperbolicDistance(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		diskRadius: number
	): number {
		// Normalize to unit disk
		const ax = x1 / diskRadius;
		const ay = y1 / diskRadius;
		const bx = x2 / diskRadius;
		const by = y2 / diskRadius;

		// Euclidean distance between points
		const dx = bx - ax;
		const dy = by - ay;
		const euclidean = Math.sqrt(dx * dx + dy * dy);

		// Poincaré disk metric
		const denom = (1 - ax * ax - ay * ay) * (1 - bx * bx - by * by);
		if (denom <= 0) return Infinity;

		const delta = (2 * euclidean * euclidean) / denom;
		return Math.acosh(1 + delta);
	}

	/**
	 * Calculates render scale based on hyperbolic distance from center.
	 * Boids at edge appear smaller (receding into infinity).
	 *
	 * @param x - Boid X position
	 * @param y - Boid Y position
	 * @param centerX - World center X
	 * @param centerY - World center Y
	 * @param maxDist - Maximum distance from center
	 * @returns Scale factor 0-1
	 */
	public static renderScale(
		x: number,
		y: number,
		centerX: number,
		centerY: number,
		maxDist: number
	): number {
		const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
		const normalized = dist / maxDist;
		// Quadratic falloff for visual effect
		return 1 / (1 + normalized * normalized);
	}

	/**
	 * Linear falloff for comparison (baseline).
	 */
	public static linearInfluence(euclideanDist: number, maxDist: number): number {
		if (maxDist <= 0) return 0;
		return Math.max(0, 1 - euclideanDist / maxDist);
	}

	/**
	 * Inverse square falloff (physics-based).
	 */
	public static inverseSquareInfluence(euclideanDist: number, minDist = 1): number {
		const d = Math.max(minDist, euclideanDist);
		return 1 / (d * d);
	}
}

/**
 * Provides hyperbolic influence with toggle support.
 */
export class InfluenceDimension {
	/** Whether hyperbolic influence is enabled */
	private _enabled = false;

	/** Steepness of the sigmoid curve */
	private _steepness = 8;

	/** Track influence calculations for metrics */
	private _totalCalculations = 0;
	private _avgInfluence = 0;
	private _influenceSum = 0;

	/**
	 * Whether hyperbolic influence is enabled.
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(value: boolean) {
		this._enabled = value;
	}

	/**
	 * Gets/sets the sigmoid steepness.
	 */
	public get steepness(): number {
		return this._steepness;
	}

	public set steepness(value: number) {
		this._steepness = Math.max(1, Math.min(20, value));
	}

	/**
	 * Resets per-frame counters.
	 */
	public beginFrame(): void {
		this._totalCalculations = 0;
		this._influenceSum = 0;
	}

	/**
	 * Calculates influence based on distance.
	 *
	 * When enabled: Sigmoid falloff (sharp transition)
	 * When disabled: Returns 1.0 (no distance-based weighting)
	 *
	 * @param distance - Distance to neighbor
	 * @param maxDistance - Maximum distance (vision radius)
	 * @returns Influence value 0-1
	 */
	public calculateInfluence(distance: number, maxDistance: number): number {
		this._totalCalculations++;

		if (!this._enabled) {
			return 1.0; // No distance-based falloff
		}

		const influence = HyperbolicSpace.influence(distance, maxDistance, this._steepness);
		this._influenceSum += influence;
		return influence;
	}

	/**
	 * Calculates influence from squared distance (avoids sqrt).
	 */
	public calculateInfluenceFromSqrDist(sqrDistance: number, sqrMaxDistance: number): number {
		this._totalCalculations++;

		if (!this._enabled) {
			return 1.0;
		}

		// Approximate normalized distance from squared values
		// This avoids the sqrt but is less accurate
		const normalizedSqr = sqrDistance / sqrMaxDistance;
		const normalized = Math.sqrt(normalizedSqr); // Still need sqrt for sigmoid

		const influence = 1 / (1 + Math.exp(this._steepness * (normalized - 0.5)));
		this._influenceSum += influence;
		return influence;
	}

	/**
	 * Updates the impact metric.
	 */
	public updateMetrics(): void {
		if (this._enabled && this._totalCalculations > 0) {
			this._avgInfluence = this._influenceSum / this._totalCalculations;
			const dropoff = ((1 - this._avgInfluence) * 100).toFixed(0);
			performanceMetrics.setImpact('influence', `${dropoff}% falloff`, this._avgInfluence);
		} else {
			performanceMetrics.setImpact('influence', '--', 0);
		}
	}

	/**
	 * Gets statistics for this frame.
	 */
	public getStats(): { calculations: number; avgInfluence: number } {
		return {
			calculations: this._totalCalculations,
			avgInfluence:
				this._totalCalculations > 0 ? this._influenceSum / this._totalCalculations : 0,
		};
	}

	/**
	 * Resets the dimension state.
	 */
	public reset(): void {
		this._totalCalculations = 0;
		this._influenceSum = 0;
		this._avgInfluence = 0;
	}
}

/**
 * Singleton instance.
 */
export const influenceDimension = new InfluenceDimension();

