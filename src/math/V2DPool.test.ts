/**
 * Unit tests for V2DPool class.
 */

import { describe, it, expect } from 'vitest';
import { V2DPool } from './V2DPool.js';

describe('V2DPool', () => {
	// Create fresh pool for each test to avoid shared state
	function createPool(size = 10): V2DPool {
		return new V2DPool(size);
	}

	describe('constructor', () => {
		it('should create a pool with specified initial size', () => {
			const pool = createPool(10);
			expect(pool.stats.size).toBe(10);
			expect(pool.stats.used).toBe(0);
		});

		it('should use default size of 500', () => {
			const defaultPool = new V2DPool();
			expect(defaultPool.stats.size).toBe(500);
		});
	});

	describe('get', () => {
		it('should return a vector initialized to (0, 0) by default', () => {
			const pool = createPool();
			const v = pool.get();
			expect(v.x).toBe(0);
			expect(v.y).toBe(0);
		});

		it('should return a vector with specified components', () => {
			const pool = createPool();
			const v = pool.get(5, 10);
			expect(v.x).toBe(5);
			expect(v.y).toBe(10);
		});

		it('should increment used count', () => {
			const pool = createPool();
			pool.get();
			pool.get();
			pool.get();
			expect(pool.stats.used).toBe(3);
		});

		it('should reuse vectors after reset', () => {
			const pool = createPool();
			const v1 = pool.get(1, 2);
			pool.reset();
			const v2 = pool.get(3, 4);

			// Should be the same object
			expect(v1).toBe(v2);
			expect(v2.x).toBe(3);
			expect(v2.y).toBe(4);
		});
	});

	describe('getFrom', () => {
		it('should copy values from source vector', () => {
			const pool = createPool();
			const source = { x: 7, y: 8 };
			const v = pool.getFrom(source);
			expect(v.x).toBe(7);
			expect(v.y).toBe(8);
		});
	});

	describe('reset', () => {
		it('should reset used count to 0', () => {
			const pool = createPool();
			pool.get();
			pool.get();
			pool.get();
			pool.reset();
			expect(pool.stats.used).toBe(0);
		});

		it('should track peak usage', () => {
			const pool = createPool();
			pool.get();
			pool.get();
			pool.get();
			pool.reset();
			expect(pool.stats.peakUsage).toBe(3);

			pool.get();
			pool.get();
			pool.reset();
			expect(pool.stats.peakUsage).toBe(3); // Still 3, not 2
		});

		it('should update peak usage when exceeded', () => {
			const pool = createPool();
			pool.get();
			pool.get();
			pool.get();
			pool.reset();

			pool.get();
			pool.get();
			pool.get();
			pool.get();
			pool.get();
			pool.reset();

			expect(pool.stats.peakUsage).toBe(5);
		});
	});

	describe('auto-expansion', () => {
		it('should expand when pool is exhausted', () => {
			const pool = createPool(10);
			// Use all 10 vectors
			for (let i = 0; i < 10; i++) {
				pool.get();
			}

			// Get one more - should trigger expansion
			const v = pool.get();
			expect(v).toBeDefined();
			expect(pool.stats.size).toBeGreaterThan(10);
			expect(pool.stats.expansions).toBe(1);
		});

		it('should expand by 50%', () => {
			const pool = createPool(10);
			for (let i = 0; i < 11; i++) {
				pool.get();
			}
			// 10 * 1.5 = 15
			expect(pool.stats.size).toBe(15);
		});
	});

	describe('prewarm', () => {
		it('should expand pool to specified size', () => {
			const pool = createPool();
			pool.prewarm(100);
			expect(pool.stats.size).toBe(100);
		});

		it('should not shrink pool', () => {
			const pool = createPool();
			pool.prewarm(100);
			pool.prewarm(50);
			expect(pool.stats.size).toBe(100);
		});
	});

	describe('stats', () => {
		it('should track all statistics', () => {
			const pool = createPool(10);
			pool.get();
			pool.get();
			pool.reset();
			pool.get();

			const stats = pool.stats;
			expect(stats.size).toBe(10);
			expect(stats.used).toBe(1);
			expect(stats.peakUsage).toBe(2);
			expect(stats.expansions).toBe(0);
		});
	});

	describe('typical usage pattern', () => {
		it('should handle frame-based usage', () => {
			const pool = createPool();
			// Simulate multiple frames
			for (let frame = 0; frame < 5; frame++) {
				pool.reset();

				// Use some vectors
				for (let i = 0; i < 5; i++) {
					const v = pool.get(i, i * 2);
					expect(v.x).toBe(i);
					expect(v.y).toBe(i * 2);
				}
			}

			expect(pool.stats.peakUsage).toBe(5);
		});
	});
});

