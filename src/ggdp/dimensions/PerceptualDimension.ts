/**
 * PerceptualDimension - Geodesic perception with blind spots.
 *
 * Real birds have limited fields of view - they can't see directly behind them.
 * This dimension adds directional awareness:
 * - Blind spot in rear cone (configurable angle)
 * - Neighbors weighted by relative angle (front = 1.0, sides = 0.5)
 *
 * When enabled: Ignores neighbors in blind spot, weights by angle
 * When disabled: All neighbors treated equally (omnidirectional)
 */

import type { BoidEntity } from '../../entities/BoidEntity.js';
import { performanceMetrics } from '../metrics/PerformanceMetrics.js';

/**
 * Result of a perception check.
 */
export interface PerceptionResult {
	/** Whether the neighbor is visible (not in blind spot) */
	visible: boolean;
	/** Perception weight (0-1, higher = more influence) */
	weight: number;
	/** Relative angle from boid's heading to neighbor */
	relativeAngle: number;
}

/**
 * Normalizes an angle to the range [-PI, PI].
 */
function normalizeAngle(angle: number): number {
	while (angle > Math.PI) angle -= Math.PI * 2;
	while (angle < -Math.PI) angle += Math.PI * 2;
	return angle;
}

/**
 * Static methods for geodesic perception calculations.
 */
export class GeodesicPerception {
	/**
	 * Checks if a neighbor is within the boid's field of view.
	 *
	 * @param boid - The perceiving boid
	 * @param neighbor - The potential neighbor
	 * @param fovAngle - Field of view angle in radians (default ~270°)
	 * @param blindSpotAngle - Blind spot angle in radians (default ~90°)
	 * @returns Perception result with visibility and weight
	 */
	public static checkPerception(
		boid: BoidEntity,
		neighbor: BoidEntity,
		_fovAngle: number = Math.PI * 1.5,
		blindSpotAngle: number = Math.PI * 0.5
	): PerceptionResult {
		// Get boid's heading from velocity
		const heading = Math.atan2(boid.velocity.y, boid.velocity.x);

		// Get angle to neighbor
		const dx = neighbor.x - boid.x;
		const dy = neighbor.y - boid.y;
		const angleToNeighbor = Math.atan2(dy, dx);

		// Calculate relative angle
		const relativeAngle = normalizeAngle(angleToNeighbor - heading);
		const absAngle = Math.abs(relativeAngle);

		// Check if in blind spot (rear cone)
		// Blind spot is centered at PI (directly behind)
		const blindSpotThreshold = Math.PI - blindSpotAngle / 2;
		const visible = absAngle < blindSpotThreshold;

		// Calculate perception weight
		// Front (0°) = 1.0, sides (±90°) = 0.5, near blind spot = 0.1
		let weight = 0;
		if (visible) {
			// Linear falloff from front to sides
			weight = 1.0 - (absAngle / Math.PI) * 0.9;
			weight = Math.max(0.1, weight);
		}

		return { visible, weight, relativeAngle };
	}

	/**
	 * Simplified check - just returns if neighbor is in field of view.
	 */
	public static isInFieldOfView(
		boid: BoidEntity,
		neighbor: BoidEntity,
		blindSpotAngle: number = Math.PI * 0.5
	): boolean {
		const heading = Math.atan2(boid.velocity.y, boid.velocity.x);
		const dx = neighbor.x - boid.x;
		const dy = neighbor.y - boid.y;
		const angleToNeighbor = Math.atan2(dy, dx);
		const relativeAngle = normalizeAngle(angleToNeighbor - heading);

		const blindSpotThreshold = Math.PI - blindSpotAngle / 2;
		return Math.abs(relativeAngle) < blindSpotThreshold;
	}

	/**
	 * Gets perception weight based on relative angle.
	 * Front = 1.0, sides = 0.5, near blind spot = 0.1
	 */
	public static getPerceptionWeight(relativeAngle: number): number {
		const absAngle = Math.abs(normalizeAngle(relativeAngle));
		const weight = 1.0 - (absAngle / Math.PI) * 0.9;
		return Math.max(0.1, weight);
	}
}

/**
 * Provides geodesic perception with toggle support.
 */
export class PerceptualDimension {
	/** Whether geodesic perception is enabled */
	private _enabled = false;

	/** Blind spot angle in radians */
	private _blindSpotAngle = Math.PI * 0.5; // 90 degrees

	/** Field of view angle in radians */
	private _fovAngle = Math.PI * 1.5; // 270 degrees

	/** Track filtered neighbors for metrics */
	private _totalChecked = 0;
	private _filteredOut = 0;

	/**
	 * Whether geodesic perception is enabled.
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(value: boolean) {
		this._enabled = value;
	}

	/**
	 * Gets/sets the blind spot angle.
	 */
	public get blindSpotAngle(): number {
		return this._blindSpotAngle;
	}

	public set blindSpotAngle(value: number) {
		this._blindSpotAngle = Math.max(0, Math.min(Math.PI, value));
	}

	/**
	 * Gets/sets the field of view angle.
	 */
	public get fovAngle(): number {
		return this._fovAngle;
	}

	public set fovAngle(value: number) {
		this._fovAngle = Math.max(0, Math.min(Math.PI * 2, value));
	}

	/**
	 * Resets per-frame counters.
	 */
	public beginFrame(): void {
		this._totalChecked = 0;
		this._filteredOut = 0;
	}

	/**
	 * Filters and weights a neighbor based on perception.
	 *
	 * When enabled: Checks blind spot and returns weight
	 * When disabled: Returns weight of 1.0 for all neighbors
	 *
	 * @returns Weight (0 = filtered out, >0 = visible with weight)
	 */
	public filterNeighbor(boid: BoidEntity, neighbor: BoidEntity): number {
		this._totalChecked++;

		if (!this._enabled) {
			return 1.0; // All neighbors equally weighted
		}

		const result = GeodesicPerception.checkPerception(
			boid,
			neighbor,
			this._fovAngle,
			this._blindSpotAngle
		);

		if (!result.visible) {
			this._filteredOut++;
			return 0;
		}

		return result.weight;
	}

	/**
	 * Batch filters neighbors, returning only visible ones with weights.
	 */
	public filterNeighbors(
		boid: BoidEntity,
		neighbors: readonly BoidEntity[]
	): { neighbor: BoidEntity; weight: number }[] {
		if (!this._enabled) {
			return neighbors.map((n) => ({ neighbor: n, weight: 1.0 }));
		}

		const result: { neighbor: BoidEntity; weight: number }[] = [];

		for (const neighbor of neighbors) {
			const weight = this.filterNeighbor(boid, neighbor);
			if (weight > 0) {
				result.push({ neighbor, weight });
			}
		}

		return result;
	}

	/**
	 * Updates the impact metric.
	 */
	public updateMetrics(): void {
		if (this._enabled && this._totalChecked > 0) {
			const filterRate = (this._filteredOut / this._totalChecked) * 100;
			performanceMetrics.setImpact(
				'perceptual',
				`-${filterRate.toFixed(0)}% blind`,
				this._filteredOut
			);
		} else {
			performanceMetrics.setImpact('perceptual', '--', 0);
		}
	}

	/**
	 * Gets statistics for this frame.
	 */
	public getStats(): { totalChecked: number; filteredOut: number; filterRate: number } {
		return {
			totalChecked: this._totalChecked,
			filteredOut: this._filteredOut,
			filterRate: this._totalChecked > 0 ? this._filteredOut / this._totalChecked : 0,
		};
	}

	/**
	 * Resets the dimension state.
	 */
	public reset(): void {
		this._totalChecked = 0;
		this._filteredOut = 0;
	}
}

/**
 * Singleton instance.
 */
export const perceptualDimension = new PerceptualDimension();

