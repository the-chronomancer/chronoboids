/**
 * SpatialDimension - Toggleable spatial hash optimization.
 *
 * When enabled: Uses O(1) spatial hash for neighbor queries
 * When disabled: Falls back to O(n²) naive neighbor search
 *
 * This allows A/B comparison of the performance impact of spatial partitioning.
 */

import type { BoidEntity } from '../../entities/BoidEntity.js';
import { SpatialHash } from '../../spatial/SpatialHash.js';
import { performanceMetrics } from '../metrics/PerformanceMetrics.js';

/**
 * Provides spatial partitioning with toggle support.
 */
export class SpatialDimension {
	/** The underlying spatial hash */
	private readonly spatialHash: SpatialHash<BoidEntity>;

	/** Whether spatial hashing is enabled */
	private _enabled: boolean;

	/** Reference to all boids for naive fallback */
	private allBoids: readonly BoidEntity[] = [];

	/** Track neighbor checks for metrics */
	private _neighborChecks = 0;

	/**
	 * Creates a new SpatialDimension.
	 */
	public constructor(cellSize: number, width: number, height: number, enabled = true) {
		this.spatialHash = new SpatialHash(cellSize, width, height);
		this._enabled = enabled;
	}

	/**
	 * Whether spatial hashing is enabled.
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(value: boolean) {
		this._enabled = value;
	}

	/**
	 * Gets the underlying spatial hash for grid visualization.
	 */
	public getSpatialHash(): SpatialHash<BoidEntity> {
		return this.spatialHash;
	}

	/**
	 * Gets the current cell size.
	 */
	public getCellSize(): number {
		return this.spatialHash.getCellSize();
	}

	/**
	 * Updates the spatial hash dimensions.
	 */
	public resize(cellSize: number, width: number, height: number): boolean {
		return this.spatialHash.resize(cellSize, width, height);
	}

	/**
	 * Clears and rebuilds the spatial index with all boids.
	 */
	public rebuild(boids: readonly BoidEntity[]): void {
		this.allBoids = boids;
		this._neighborChecks = 0;

		if (this._enabled) {
			performanceMetrics.startMeasure('spatial');
			this.spatialHash.clear();
			this.spatialHash.insertAll(boids);
			performanceMetrics.endMeasure('spatial');
		}
	}

	/**
	 * Gets candidate neighbors for a boid.
	 *
	 * When enabled: Returns only boids in nearby spatial hash cells (O(1) lookup)
	 * When disabled: Returns ALL boids for O(n²) comparison
	 *
	 * @param boid - The boid to find neighbors for
	 * @returns Array of candidate arrays (either spatial cells or single array of all boids)
	 */
	public getCandidates(boid: BoidEntity): readonly (readonly BoidEntity[])[] {
		if (this._enabled) {
			return this.spatialHash.queryNearby(boid.x, boid.y);
		} else {
			// Naive O(n²) fallback - return all boids as a single "cell"
			return [this.allBoids];
		}
	}

	/**
	 * Counts total candidates that will be checked.
	 */
	public countCandidates(candidates: readonly (readonly BoidEntity[])[]): number {
		let count = 0;
		for (const cell of candidates) {
			count += cell.length;
		}
		this._neighborChecks += count;
		return count;
	}

	/**
	 * Gets the neighbor check count for this frame.
	 */
	public get neighborChecks(): number {
		return this._neighborChecks;
	}

	/**
	 * Updates the impact metric based on current state.
	 */
	public updateMetrics(totalBoids: number): void {
		if (this._enabled) {
			// Calculate reduction vs naive O(n²)
			const naiveChecks = totalBoids * totalBoids;
			const reduction = naiveChecks > 0 ? ((naiveChecks - this._neighborChecks) / naiveChecks) * 100 : 0;

			performanceMetrics.setImpact(
				'spatial',
				`-${reduction.toFixed(0)}% checks`,
				this._neighborChecks
			);
		} else {
			performanceMetrics.setImpact('spatial', 'O(n²) baseline', this._neighborChecks);
		}

		performanceMetrics.addNeighborChecks(this._neighborChecks);
	}

	/**
	 * Resets the dimension state.
	 */
	public reset(): void {
		this.spatialHash.clear();
		this._neighborChecks = 0;
	}
}

