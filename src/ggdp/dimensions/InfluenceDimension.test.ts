/**
 * Tests for InfluenceDimension - Hyperbolic distance falloff.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HyperbolicSpace, InfluenceDimension } from './InfluenceDimension.js';

describe('HyperbolicSpace', () => {
	describe('influence (sigmoid falloff)', () => {
	it('should return ~1.0 for very close distances', () => {
		const influence = HyperbolicSpace.influence(0, 100);
		expect(influence).toBeGreaterThan(0.95);
	});

		it('should return ~0.5 at half the max distance', () => {
			const influence = HyperbolicSpace.influence(50, 100);
			expect(influence).toBeGreaterThan(0.4);
			expect(influence).toBeLessThan(0.6);
		});

		it('should return ~0 for distances at max', () => {
			const influence = HyperbolicSpace.influence(100, 100);
			expect(influence).toBeLessThan(0.1);
		});

		it('should return 0 for zero max distance', () => {
			const influence = HyperbolicSpace.influence(50, 0);
			expect(influence).toBe(0);
		});

		it('should have steeper falloff with higher steepness', () => {
			const gentle = HyperbolicSpace.influence(60, 100, 4);
			const steep = HyperbolicSpace.influence(60, 100, 12);

			expect(steep).toBeLessThan(gentle);
		});
	});

	describe('linearInfluence', () => {
		it('should return 1.0 at distance 0', () => {
			const influence = HyperbolicSpace.linearInfluence(0, 100);
			expect(influence).toBe(1.0);
		});

		it('should return 0.5 at half distance', () => {
			const influence = HyperbolicSpace.linearInfluence(50, 100);
			expect(influence).toBe(0.5);
		});

		it('should return 0 at max distance', () => {
			const influence = HyperbolicSpace.linearInfluence(100, 100);
			expect(influence).toBe(0);
		});

		it('should clamp to 0 for distances beyond max', () => {
			const influence = HyperbolicSpace.linearInfluence(150, 100);
			expect(influence).toBe(0);
		});
	});

	describe('inverseSquareInfluence', () => {
		it('should return 1.0 at distance 1', () => {
			const influence = HyperbolicSpace.inverseSquareInfluence(1);
			expect(influence).toBe(1.0);
		});

		it('should return 0.25 at distance 2', () => {
			const influence = HyperbolicSpace.inverseSquareInfluence(2);
			expect(influence).toBe(0.25);
		});

		it('should use minDist for very small distances', () => {
			const influence = HyperbolicSpace.inverseSquareInfluence(0.1, 1);
			expect(influence).toBe(1.0); // Uses minDist of 1
		});
	});

	describe('hyperbolicDistance', () => {
		it('should return 0 for same point', () => {
			const dist = HyperbolicSpace.hyperbolicDistance(0, 0, 0, 0, 100);
			expect(dist).toBeCloseTo(0, 5);
		});

		it('should increase with Euclidean distance', () => {
			const near = HyperbolicSpace.hyperbolicDistance(0, 0, 10, 0, 100);
			const far = HyperbolicSpace.hyperbolicDistance(0, 0, 50, 0, 100);

			expect(far).toBeGreaterThan(near);
		});

		it('should approach infinity near disk edge', () => {
			// Points near the edge of the Poincaré disk
			const dist = HyperbolicSpace.hyperbolicDistance(0, 0, 99, 0, 100);
			expect(dist).toBeGreaterThan(5); // Large hyperbolic distance
		});
	});

	describe('renderScale', () => {
		it('should return 1.0 at center', () => {
			const scale = HyperbolicSpace.renderScale(50, 50, 50, 50, 100);
			expect(scale).toBe(1.0);
		});

		it('should decrease towards edges', () => {
			const center = HyperbolicSpace.renderScale(50, 50, 50, 50, 100);
			const edge = HyperbolicSpace.renderScale(100, 50, 50, 50, 100);

			expect(edge).toBeLessThan(center);
		});
	});
});

describe('InfluenceDimension', () => {
	let dimension: InfluenceDimension;

	beforeEach(() => {
		dimension = new InfluenceDimension();
	});

	it('should start disabled', () => {
		expect(dimension.enabled).toBe(false);
	});

	it('should toggle enabled state', () => {
		dimension.enabled = true;
		expect(dimension.enabled).toBe(true);
	});

	it('should have default steepness of 8', () => {
		expect(dimension.steepness).toBe(8);
	});

	it('should clamp steepness', () => {
		dimension.steepness = 0;
		expect(dimension.steepness).toBe(1);

		dimension.steepness = 100;
		expect(dimension.steepness).toBe(20);
	});

	it('should return 1.0 when disabled', () => {
		dimension.enabled = false;
		dimension.beginFrame();

		const influence = dimension.calculateInfluence(50, 100);
		expect(influence).toBe(1.0);
	});

	it('should apply sigmoid falloff when enabled', () => {
		dimension.enabled = true;
		dimension.beginFrame();

		const close = dimension.calculateInfluence(10, 100);
		const mid = dimension.calculateInfluence(50, 100);
		const far = dimension.calculateInfluence(90, 100);

		expect(close).toBeGreaterThan(mid);
		expect(mid).toBeGreaterThan(far);
	});

	it('should calculate from squared distance', () => {
		dimension.enabled = true;
		dimension.beginFrame();

		const sqrDist = 2500; // sqrt = 50
		const sqrMax = 10000; // sqrt = 100
		const influence = dimension.calculateInfluenceFromSqrDist(sqrDist, sqrMax);

		expect(influence).toBeGreaterThan(0.4);
		expect(influence).toBeLessThan(0.6);
	});

	it('should track statistics', () => {
		dimension.enabled = true;
		dimension.beginFrame();

		dimension.calculateInfluence(10, 100);
		dimension.calculateInfluence(50, 100);
		dimension.calculateInfluence(90, 100);

		const stats = dimension.getStats();
		expect(stats.calculations).toBe(3);
		expect(stats.avgInfluence).toBeGreaterThan(0);
	});

	it('should reset counters on beginFrame', () => {
		dimension.enabled = true;
		dimension.beginFrame();
		dimension.calculateInfluence(50, 100);

		dimension.beginFrame(); // New frame

		const stats = dimension.getStats();
		expect(stats.calculations).toBe(0);
	});

	it('should reset state', () => {
		dimension.enabled = true;
		dimension.beginFrame();
		dimension.calculateInfluence(50, 100);

		dimension.reset();

		const stats = dimension.getStats();
		expect(stats.calculations).toBe(0);
		expect(stats.avgInfluence).toBe(0);
	});
});

