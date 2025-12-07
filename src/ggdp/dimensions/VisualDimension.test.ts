/**
 * Tests for VisualDimension - Visual fiber for stress-based render batching.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualFiber, computeBoidStress, VisualDimension } from './VisualDimension.js';
import { BoidEntity } from '../../entities/BoidEntity.js';

describe('VisualFiber', () => {
	// Create fresh fiber for each test to ensure isolation
	const createFiber = () => new VisualFiber();

	describe('computeHash', () => {
		it('should encode stress in high nibble', () => {
			const fiber = createFiber();
			const hash = fiber.computeHash(0.5, 0);
			expect(hash >> 4).toBe(8); // 0.5 * 16 = 8
		});

		it('should encode speed in low nibble', () => {
			const fiber = createFiber();
			const hash = fiber.computeHash(0, 0.5);
			expect(hash & 0xf).toBe(8); // 0.5 * 16 = 8
		});

		it('should combine stress and speed', () => {
			const fiber = createFiber();
			const hash = fiber.computeHash(1.0, 1.0);
			expect(hash).toBe(0xff); // Both maxed out
		});

		it('should clamp to valid range', () => {
			const fiber = createFiber();
			const hash = fiber.computeHash(2.0, 2.0); // Over 1.0
			expect(hash).toBe(0xff); // Clamped to max
		});
	});

	describe('insert and getBuckets', () => {
		it('should insert boid into correct bucket', () => {
			const fiber = createFiber();
			const boid = BoidEntity.createRandom(0, 100, 100, 1, 2);
			const hash = fiber.computeHash(0.5, 0.5);

			fiber.insert(boid, hash);

			const buckets = fiber.getBuckets();
			expect(buckets.get(hash)).toContain(boid);
		});

		it('should group boids with same hash', () => {
			const fiber = createFiber();
			const boid1 = BoidEntity.createRandom(0, 100, 100, 1, 2);
			const boid2 = BoidEntity.createRandom(1, 100, 100, 1, 2);
			const hash = fiber.computeHash(0.5, 0.5);

			fiber.insert(boid1, hash);
			fiber.insert(boid2, hash);

			const buckets = fiber.getBuckets();
			expect(buckets.get(hash)!.length).toBe(2);
		});
	});

	describe('bucketCount', () => {
		it('should return 0 for empty fiber', () => {
			const fiber = createFiber();
			expect(fiber.bucketCount).toBe(0);
		});

		it('should count non-empty buckets', () => {
			const fiber = createFiber();
			const boid1 = BoidEntity.createRandom(0, 100, 100, 1, 2);
			const boid2 = BoidEntity.createRandom(1, 100, 100, 1, 2);

			fiber.insert(boid1, 0x00);
			fiber.insert(boid2, 0xff);

			expect(fiber.bucketCount).toBe(2);
		});
	});

	describe('getColor', () => {
		it('should return different colors for different hashes', () => {
			const fiber = createFiber();
			const color1 = fiber.getColor(0x00);
			const color2 = fiber.getColor(0xff);

			expect(color1).not.toBe(color2);
		});

		it('should be deterministic', () => {
			const fiber = createFiber();
			const color1 = fiber.getColor(0x88);
			const color2 = fiber.getColor(0x88);

			expect(color1).toBe(color2);
		});
	});

	describe('getColorHSL', () => {
		it('should return blue-ish for low stress', () => {
			const fiber = createFiber();
			const color = fiber.getColorHSL(0x0f); // Low stress, high speed
			// Blue component should be significant
			const b = color & 0xff;
			expect(b).toBeGreaterThan(0);
		});

		it('should return red-ish for high stress', () => {
			const fiber = createFiber();
			const color = fiber.getColorHSL(0xf0); // High stress, low speed
			// Red component should be significant
			const r = (color >> 16) & 0xff;
			expect(r).toBeGreaterThan(0);
		});
	});

	describe('clear', () => {
		it('should empty all buckets', () => {
			const fiber = createFiber();
			const boid = BoidEntity.createRandom(0, 100, 100, 1, 2);
			fiber.insert(boid, 0x00);

			fiber.clear();

			expect(fiber.bucketCount).toBe(0);
		});
	});
});

describe('computeBoidStress', () => {
	let boid: BoidEntity;

	beforeEach(() => {
		boid = BoidEntity.createRandom(0, 100, 100, 1, 2);
		boid.x = 50;
		boid.y = 50;
		boid.velocity.set(2, 0);
	});

	it('should return low stress for boid in center', () => {
		const stress = computeBoidStress(boid, 100, 100, 4, 0);
		expect(stress).toBeLessThan(0.3);
	});

	it('should increase stress near edges', () => {
		boid.x = 10; // Near left edge

		const stress = computeBoidStress(boid, 100, 100, 4, 0);
		expect(stress).toBeGreaterThan(0.1);
	});

	it('should increase stress with more neighbors', () => {
		const lowNeighbors = computeBoidStress(boid, 100, 100, 4, 5);
		const highNeighbors = computeBoidStress(boid, 100, 100, 4, 15);

		expect(highNeighbors).toBeGreaterThan(lowNeighbors);
	});

	it('should increase stress at high speed', () => {
		boid.velocity.set(3.5, 0); // Near max speed of 4

		const stress = computeBoidStress(boid, 100, 100, 4, 0);
		expect(stress).toBeGreaterThan(0);
	});

	it('should increase stress near threat', () => {
		const noThreat = computeBoidStress(boid, 100, 100, 4, 0);
		const withThreat = computeBoidStress(boid, 100, 100, 4, 0, 20, 55, 55, 100);

		expect(withThreat).toBeGreaterThan(noThreat);
	});

	it('should cap stress at 1.0', () => {
		// Create very stressful conditions
		boid.x = 5; // Near edge
		boid.velocity.set(4, 0); // Max speed

		const stress = computeBoidStress(boid, 100, 100, 4, 30, 20, 50, 50, 100);
		expect(stress).toBeLessThanOrEqual(1.0);
	});
});

describe('VisualDimension', () => {
	let dimension: VisualDimension;
	let boids: BoidEntity[];

	beforeEach(() => {
		dimension = new VisualDimension();
		boids = [];
		for (let i = 0; i < 10; i++) {
			const boid = BoidEntity.createRandom(i, 200, 200, 1, 4);
			boid.x = 100;
			boid.y = 100;
			boid.velocity.set(2, 0);
			boids.push(boid);
		}
	});

	it('should start disabled', () => {
		expect(dimension.enabled).toBe(false);
	});

	it('should toggle enabled state', () => {
		dimension.enabled = true;
		expect(dimension.enabled).toBe(true);
	});

	describe('when disabled', () => {
		beforeEach(() => {
			dimension.enabled = false;
		});

		it('should return 0 stress', () => {
			const stress = dimension.computeStress(boids[0]!, 200, 200, 4);
			expect(stress).toBe(0);
		});

		it('should return speed-based color', () => {
			const color = dimension.getColor(boids[0]!, 4);
			expect(color).toBeGreaterThan(0);
		});
	});

	describe('when enabled', () => {
		beforeEach(() => {
			dimension.enabled = true;
		});

		it('should compute and cache stress', () => {
			dimension.beginFrame();
			const stress = dimension.computeStress(boids[0]!, 200, 200, 4);

			expect(stress).toBeGreaterThanOrEqual(0);
			expect(stress).toBeLessThanOrEqual(1);

			// Should be cached
			const cached = dimension.getStress(boids[0]!);
			expect(cached).toBe(stress);
		});

		it('should return stress-based color', () => {
			dimension.beginFrame();
			dimension.computeStress(boids[0]!, 200, 200, 4);

			const color = dimension.getColor(boids[0]!, 4);
			expect(color).toBeGreaterThan(0);
		});

		it('should batch boids by visual state', () => {
			// Ensure dimension is enabled for this test
			const dim = new VisualDimension();
			dim.enabled = true;
			dim.beginFrame();

			for (const boid of boids) {
				dim.computeStress(boid, 200, 200, 4);
			}

			dim.batchBoids(boids, 4);

			const stats = dim.getStats();
			expect(stats.totalBoids).toBe(10);
			expect(stats.batches).toBeGreaterThan(0);
		});

		it('should include threat in stress calculation', () => {
			dimension.beginFrame();

			const noThreat = dimension.computeStress(boids[0]!, 200, 200, 4);
			dimension.beginFrame(); // Reset
			const withThreat = dimension.computeStress(boids[0]!, 200, 200, 4, 100, 100);

			expect(withThreat).toBeGreaterThan(noThreat);
		});
	});

	describe('statistics', () => {
		beforeEach(() => {
			dimension.enabled = true;
		});

		it('should track batch count', () => {
			dimension.beginFrame();
			for (const boid of boids) {
				dimension.computeStress(boid, 200, 200, 4);
			}
			dimension.batchBoids(boids, 4);

			const stats = dimension.getStats();
			expect(stats.batches).toBeGreaterThan(0);
			expect(stats.avgPerBatch).toBeGreaterThan(0);
		});

		it('should reset on beginFrame', () => {
			dimension.beginFrame();
			dimension.batchBoids(boids, 4);

			dimension.beginFrame(); // New frame

			const stats = dimension.getStats();
			expect(stats.batches).toBe(0);
			expect(stats.totalBoids).toBe(0);
		});

		it('should reset state', () => {
			dimension.beginFrame();
			dimension.computeStress(boids[0]!, 200, 200, 4);
			dimension.batchBoids(boids, 4);

			dimension.reset();

			const stats = dimension.getStats();
			expect(stats.batches).toBe(0);
			expect(stats.totalBoids).toBe(0);
		});
	});
});

