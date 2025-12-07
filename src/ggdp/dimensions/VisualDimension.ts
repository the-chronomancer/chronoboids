/**
 * VisualDimension - Visual fiber for stress-based render batching.
 *
 * Boids have visual state (stress level, velocity). Grouping by visual
 * state enables batch rendering and creates beautiful stress wave
 * visualizations.
 *
 * When enabled: Colors boids by stress/speed hash
 * When disabled: Standard speed-based coloring
 */

import type { BoidEntity } from '../../entities/BoidEntity.js';
import { performanceMetrics } from '../metrics/PerformanceMetrics.js';

/**
 * Computes stress for a boid based on environmental factors.
 */
export interface StressFactors {
	/** Distance to nearest edge (0-1, 0 = at edge) */
	edgeProximity: number;
	/** Number of neighbors (normalized) */
	crowding: number;
	/** Speed relative to max (0-1) */
	speedRatio: number;
	/** Distance to predator/threat (0-1, 0 = at threat) */
	threatProximity: number;
}

/**
 * Visual fiber for batching boids by visual state.
 */
export class VisualFiber {
	/** Buckets of boids grouped by visual hash */
	private readonly buckets = new Map<number, BoidEntity[]>();

	/** Pre-computed colors for each hash value */
	private readonly colorCache = new Map<number, number>();

	/**
	 * Clears all buckets.
	 */
	public clear(): void {
		for (const bucket of this.buckets.values()) {
			bucket.length = 0;
		}
	}

	/**
	 * Computes a visual hash for a boid.
	 * Hash encodes stress (high nibble) and speed (low nibble).
	 *
	 * @param stress - Stress level 0-1
	 * @param speedRatio - Speed as ratio of max speed 0-1
	 * @returns 8-bit hash value
	 */
	public computeHash(stress: number, speedRatio: number): number {
		const stressBucket = Math.min(15, Math.floor(stress * 16));
		const speedBucket = Math.min(15, Math.floor(speedRatio * 16));
		return (stressBucket << 4) | speedBucket;
	}

	/**
	 * Inserts a boid into the appropriate bucket.
	 */
	public insert(boid: BoidEntity, hash: number): void {
		let bucket = this.buckets.get(hash);
		if (bucket === undefined) {
			bucket = [];
			this.buckets.set(hash, bucket);
		}
		bucket.push(boid);
	}

	/**
	 * Gets all buckets for batch rendering.
	 */
	public getBuckets(): Map<number, BoidEntity[]> {
		return this.buckets;
	}

	/**
	 * Gets the number of unique visual states.
	 */
	public get bucketCount(): number {
		let count = 0;
		for (const bucket of this.buckets.values()) {
			if (bucket.length > 0) count++;
		}
		return count;
	}

	/**
	 * Gets the color for a visual hash.
	 * Stress: blue (0) → red (15)
	 * Speed: dark (0) → bright (15)
	 *
	 * @param hash - 8-bit visual hash
	 * @returns RGB hex color
	 */
	public getColor(hash: number): number {
		// Check cache first
		let color = this.colorCache.get(hash);
		if (color !== undefined) {
			return color;
		}

		const stress = (hash >> 4) & 0xf;
		const speed = hash & 0xf;

		// Stress: blue (0) → red (15)
		const r = Math.floor((stress / 15) * 255);
		const b = Math.floor(((15 - stress) / 15) * 255);

		// Speed: brightness modifier
		const brightness = 0.5 + (speed / 15) * 0.5;

		color =
			(Math.floor(r * brightness) << 16) |
			(Math.floor(128 * brightness) << 8) |
			Math.floor(b * brightness);

		this.colorCache.set(hash, color);
		return color;
	}

	/**
	 * Gets color as HSL for more vibrant results.
	 * Stress affects hue, speed affects lightness.
	 */
	public getColorHSL(hash: number): number {
		const stress = (hash >> 4) & 0xf;
		const speed = hash & 0xf;

		// Hue: 240 (blue) → 0 (red) based on stress
		const h = ((15 - stress) / 15) * 240;
		const s = 1.0;
		const l = 0.3 + (speed / 15) * 0.4;

		return this.hslToRgb(h / 360, s, l);
	}

	/**
	 * Converts HSL to RGB hex.
	 */
	private hslToRgb(h: number, s: number, l: number): number {
		let r: number, g: number, b: number;

		if (s === 0) {
			r = g = b = l;
		} else {
			const hue2rgb = (p: number, q: number, t: number): number => {
				if (t < 0) t += 1;
				if (t > 1) t -= 1;
				if (t < 1 / 6) return p + (q - p) * 6 * t;
				if (t < 1 / 2) return q;
				if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
				return p;
			};

			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;
			r = hue2rgb(p, q, h + 1 / 3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1 / 3);
		}

		return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
	}
}

/**
 * Computes stress for a boid based on various factors.
 */
export function computeBoidStress(
	boid: BoidEntity,
	worldWidth: number,
	worldHeight: number,
	maxSpeed: number,
	neighborCount: number,
	maxNeighbors = 20,
	threatX?: number,
	threatY?: number,
	threatRadius = 200
): number {
	let stress = 0;

	// Edge stress: approaching boundaries
	const edgeMargin = 50;
	const edgeDist = Math.min(boid.x, boid.y, worldWidth - boid.x, worldHeight - boid.y);
	if (edgeDist < edgeMargin) {
		stress += (1 - edgeDist / edgeMargin) * 0.3;
	}

	// Crowd stress: too many neighbors
	if (neighborCount > maxNeighbors / 2) {
		stress += ((neighborCount - maxNeighbors / 2) / (maxNeighbors / 2)) * 0.3;
	}

	// Speed stress: moving too fast or too slow
	const speedRatio = boid.velocity.mag() / maxSpeed;
	if (speedRatio > 0.8) {
		stress += (speedRatio - 0.8) * 0.5;
	}

	// Threat stress: proximity to predator/explosion
	if (threatX !== undefined && threatY !== undefined) {
		const dx = boid.x - threatX;
		const dy = boid.y - threatY;
		const threatDist = Math.sqrt(dx * dx + dy * dy);
		if (threatDist < threatRadius) {
			stress += (1 - threatDist / threatRadius) * 0.5;
		}
	}

	return Math.min(1, stress);
}

/**
 * Provides visual fiber with toggle support.
 */
export class VisualDimension {
	/** The visual fiber for batching */
	private readonly visualFiber = new VisualFiber();

	/** Whether visual fiber is enabled */
	private _enabled = false;

	/** Cached stress values per boid */
	private readonly stressCache = new Map<number, number>();

	/** Track batch statistics */
	private _batchCount = 0;
	private _totalBoids = 0;

	/**
	 * Whether visual fiber is enabled.
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(value: boolean) {
		this._enabled = value;
	}

	/**
	 * Gets the visual fiber instance.
	 */
	public getVisualFiber(): VisualFiber {
		return this.visualFiber;
	}

	/**
	 * Resets per-frame state.
	 */
	public beginFrame(): void {
		this.visualFiber.clear();
		this._batchCount = 0;
		this._totalBoids = 0;
	}

	/**
	 * Computes and caches stress for a boid.
	 */
	public computeStress(
		boid: BoidEntity,
		worldWidth: number,
		worldHeight: number,
		maxSpeed: number,
		threatX?: number,
		threatY?: number
	): number {
		if (!this._enabled) {
			return 0;
		}

		const stress = computeBoidStress(
			boid,
			worldWidth,
			worldHeight,
			maxSpeed,
			boid.neighborCount,
			20,
			threatX,
			threatY
		);

		this.stressCache.set(boid.index, stress);
		return stress;
	}

	/**
	 * Gets cached stress for a boid.
	 */
	public getStress(boid: BoidEntity): number {
		return this.stressCache.get(boid.index) ?? 0;
	}

	/**
	 * Gets the color for a boid based on stress and speed.
	 *
	 * When enabled: Returns stress-based color
	 * When disabled: Returns standard speed-based color
	 */
	public getColor(boid: BoidEntity, maxSpeed: number, useHSL = true): number {
		if (!this._enabled) {
			// Standard speed-based hue
			const speedRatio = Math.min(boid.velocity.mag() / (maxSpeed * 2), 1);
			return this.speedToColor(speedRatio);
		}

		const stress = this.stressCache.get(boid.index) ?? 0;
		const speedRatio = Math.min(boid.velocity.mag() / maxSpeed, 1);
		const hash = this.visualFiber.computeHash(stress, speedRatio);

		return useHSL ? this.visualFiber.getColorHSL(hash) : this.visualFiber.getColor(hash);
	}

	/**
	 * Converts speed ratio to HSV color (standard boid coloring).
	 */
	private speedToColor(speedRatio: number): number {
		// HSV where H = speedRatio, S = 1, V = 1
		const h = speedRatio;
		const s = 1;
		const v = 1;

		const i = Math.floor(h * 6);
		const f = h * 6 - i;
		const p = v * (1 - s);
		const q = v * (1 - f * s);
		const t = v * (1 - (1 - f) * s);

		let r = 0,
			g = 0,
			b = 0;
		switch (i % 6) {
			case 0:
				r = v;
				g = t;
				b = p;
				break;
			case 1:
				r = q;
				g = v;
				b = p;
				break;
			case 2:
				r = p;
				g = v;
				b = t;
				break;
			case 3:
				r = p;
				g = q;
				b = v;
				break;
			case 4:
				r = t;
				g = p;
				b = v;
				break;
			case 5:
				r = v;
				g = p;
				b = q;
				break;
		}

		return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
	}

	/**
	 * Batches all boids by visual state.
	 */
	public batchBoids(boids: readonly BoidEntity[], maxSpeed: number): void {
		if (!this._enabled) return;

		this._totalBoids = boids.length;

		for (const boid of boids) {
			const stress = this.stressCache.get(boid.index) ?? 0;
			const speedRatio = Math.min(boid.velocity.mag() / maxSpeed, 1);
			const hash = this.visualFiber.computeHash(stress, speedRatio);
			this.visualFiber.insert(boid, hash);
		}

		this._batchCount = this.visualFiber.bucketCount;
	}

	/**
	 * Updates the impact metric.
	 */
	public updateMetrics(): void {
		if (this._enabled && this._totalBoids > 0) {
			performanceMetrics.setImpact('visual', `${this._batchCount} batches`, this._batchCount);
		} else {
			performanceMetrics.setImpact('visual', '--', 0);
		}
	}

	/**
	 * Gets statistics for this frame.
	 */
	public getStats(): { batches: number; totalBoids: number; avgPerBatch: number } {
		return {
			batches: this._batchCount,
			totalBoids: this._totalBoids,
			avgPerBatch: this._batchCount > 0 ? this._totalBoids / this._batchCount : 0,
		};
	}

	/**
	 * Resets the dimension state.
	 */
	public reset(): void {
		this.visualFiber.clear();
		this.stressCache.clear();
		this._batchCount = 0;
		this._totalBoids = 0;
	}
}

/**
 * Singleton instance.
 */
export const visualDimension = new VisualDimension();

