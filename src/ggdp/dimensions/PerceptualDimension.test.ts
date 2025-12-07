/**
 * Tests for PerceptualDimension - Geodesic perception with blind spots.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GeodesicPerception, PerceptualDimension } from './PerceptualDimension.js';
import { BoidEntity } from '../../entities/BoidEntity.js';

describe('GeodesicPerception', () => {
	let boid: BoidEntity;
	let neighbor: BoidEntity;

	beforeEach(() => {
		boid = BoidEntity.createRandom(0, 100, 100, 1, 2);
		neighbor = BoidEntity.createRandom(1, 100, 100, 1, 2);

		// Set boid at origin facing right (positive X)
		boid.x = 50;
		boid.y = 50;
		boid.velocity.set(1, 0); // Facing right
	});

	describe('checkPerception', () => {
		it('should see neighbor directly in front', () => {
			neighbor.x = 60; // 10 units to the right
			neighbor.y = 50;

			const result = GeodesicPerception.checkPerception(boid, neighbor);

			expect(result.visible).toBe(true);
			expect(result.weight).toBeGreaterThan(0.9); // High weight for front
		});

		it('should not see neighbor directly behind (in blind spot)', () => {
			neighbor.x = 40; // 10 units to the left (behind)
			neighbor.y = 50;

			const result = GeodesicPerception.checkPerception(
				boid,
				neighbor,
				Math.PI * 1.5, // 270° FOV
				Math.PI * 0.5 // 90° blind spot
			);

			expect(result.visible).toBe(false);
		});

		it('should see neighbor to the side with reduced weight', () => {
			neighbor.x = 50;
			neighbor.y = 40; // 10 units above (to the side when facing right)

			const result = GeodesicPerception.checkPerception(boid, neighbor);

			expect(result.visible).toBe(true);
			expect(result.weight).toBeLessThan(0.9);
			expect(result.weight).toBeGreaterThan(0.1);
		});

		it('should calculate relative angle correctly', () => {
			neighbor.x = 60;
			neighbor.y = 50;

			const result = GeodesicPerception.checkPerception(boid, neighbor);

			expect(result.relativeAngle).toBeCloseTo(0, 2); // Directly in front
		});
	});

	describe('isInFieldOfView', () => {
		it('should return true for neighbor in front', () => {
			neighbor.x = 60;
			neighbor.y = 50;

			expect(GeodesicPerception.isInFieldOfView(boid, neighbor)).toBe(true);
		});

		it('should return false for neighbor in blind spot', () => {
			neighbor.x = 40; // Behind
			neighbor.y = 50;

			expect(
				GeodesicPerception.isInFieldOfView(
					boid,
					neighbor,
					Math.PI * 0.5 // 90° blind spot
				)
			).toBe(false);
		});

		it('should return true for neighbor at side', () => {
			// Set neighbor at 90 degrees (directly to the side)
			neighbor.x = 50;
			neighbor.y = 50 + 10;

			// With 90° blind spot, 90° (side) should be visible
			expect(GeodesicPerception.isInFieldOfView(boid, neighbor, Math.PI * 0.5)).toBe(true);
		});
	});

	describe('getPerceptionWeight', () => {
		it('should return ~1.0 for angle 0 (front)', () => {
			const weight = GeodesicPerception.getPerceptionWeight(0);
			expect(weight).toBeCloseTo(1.0, 1);
		});

		it('should return ~0.55 for angle PI/2 (side)', () => {
			const weight = GeodesicPerception.getPerceptionWeight(Math.PI / 2);
			expect(weight).toBeGreaterThan(0.4);
			expect(weight).toBeLessThan(0.7);
		});

		it('should return low weight for angle near PI (rear)', () => {
			const weight = GeodesicPerception.getPerceptionWeight(Math.PI * 0.9);
			expect(weight).toBeLessThan(0.3);
			expect(weight).toBeGreaterThanOrEqual(0.1);
		});
	});
});

describe('PerceptualDimension', () => {
	let dimension: PerceptualDimension;
	let boid: BoidEntity;
	let neighbors: BoidEntity[];

	beforeEach(() => {
		dimension = new PerceptualDimension();

		boid = BoidEntity.createRandom(0, 100, 100, 1, 2);
		boid.x = 50;
		boid.y = 50;
		boid.velocity.set(1, 0); // Facing right

		neighbors = [];
		for (let i = 1; i <= 4; i++) {
			const n = BoidEntity.createRandom(i, 100, 100, 1, 2);
			neighbors.push(n);
		}
	});

	it('should start disabled', () => {
		expect(dimension.enabled).toBe(false);
	});

	it('should toggle enabled state', () => {
		dimension.enabled = true;
		expect(dimension.enabled).toBe(true);
	});

	it('should have default blind spot angle', () => {
		expect(dimension.blindSpotAngle).toBeCloseTo(Math.PI * 0.5, 2);
	});

	it('should clamp blind spot angle', () => {
		dimension.blindSpotAngle = -1;
		expect(dimension.blindSpotAngle).toBe(0);

		dimension.blindSpotAngle = 10;
		expect(dimension.blindSpotAngle).toBe(Math.PI);
	});

	it('should return weight 1.0 for all neighbors when disabled', () => {
		dimension.enabled = false;

		for (const neighbor of neighbors) {
			const weight = dimension.filterNeighbor(boid, neighbor);
			expect(weight).toBe(1.0);
		}
	});

	it('should filter neighbors in blind spot when enabled', () => {
		dimension.enabled = true;

		// Neighbor directly behind
		neighbors[0]!.x = 40;
		neighbors[0]!.y = 50;

		// Neighbor directly in front
		neighbors[1]!.x = 60;
		neighbors[1]!.y = 50;

		dimension.beginFrame();

		const behindWeight = dimension.filterNeighbor(boid, neighbors[0]!);
		const frontWeight = dimension.filterNeighbor(boid, neighbors[1]!);

		expect(behindWeight).toBe(0); // Filtered out
		expect(frontWeight).toBeGreaterThan(0.9); // High weight
	});

	it('should batch filter neighbors', () => {
		dimension.enabled = true;

		// Set up neighbors in different positions
		neighbors[0]!.x = 40;
		neighbors[0]!.y = 50; // Behind - filtered
		neighbors[1]!.x = 60;
		neighbors[1]!.y = 50; // Front - visible
		neighbors[2]!.x = 50;
		neighbors[2]!.y = 40; // Side - visible
		neighbors[3]!.x = 50;
		neighbors[3]!.y = 60; // Side - visible

		const filtered = dimension.filterNeighbors(boid, neighbors);

		expect(filtered.length).toBe(3); // One filtered out
		expect(filtered.some((f) => f.neighbor === neighbors[0])).toBe(false);
	});

	it('should track statistics', () => {
		dimension.enabled = true;
		dimension.beginFrame();

		neighbors[0]!.x = 40;
		neighbors[0]!.y = 50; // Behind
		neighbors[1]!.x = 60;
		neighbors[1]!.y = 50; // Front

		dimension.filterNeighbor(boid, neighbors[0]!);
		dimension.filterNeighbor(boid, neighbors[1]!);

		const stats = dimension.getStats();
		expect(stats.totalChecked).toBe(2);
		expect(stats.filteredOut).toBe(1);
		expect(stats.filterRate).toBeCloseTo(0.5, 2);
	});

	it('should reset statistics', () => {
		dimension.enabled = true;
		dimension.beginFrame();
		dimension.filterNeighbor(boid, neighbors[0]!);

		dimension.reset();

		const stats = dimension.getStats();
		expect(stats.totalChecked).toBe(0);
		expect(stats.filteredOut).toBe(0);
	});

	it('should reset counters on beginFrame', () => {
		dimension.enabled = true;
		dimension.beginFrame();
		dimension.filterNeighbor(boid, neighbors[0]!);

		dimension.beginFrame(); // New frame

		const stats = dimension.getStats();
		expect(stats.totalChecked).toBe(0);
	});
});

