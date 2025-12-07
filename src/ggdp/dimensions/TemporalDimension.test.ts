/**
 * Tests for TemporalDimension - Time wheel for staggered updates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TimeWheel, TemporalDimension } from './TemporalDimension.js';
import { BoidEntity } from '../../entities/BoidEntity.js';

describe('TimeWheel', () => {
	let wheel: TimeWheel<{ index: number }>;

	beforeEach(() => {
		wheel = new TimeWheel(4); // 4 slots
	});

	it('should create with specified number of slots', () => {
		expect(wheel.size).toBe(4);
	});

	it('should start at slot 0', () => {
		expect(wheel.current).toBe(0);
	});

	it('should distribute items across slots by index', () => {
		const items = [
			{ index: 0 },
			{ index: 1 },
			{ index: 2 },
			{ index: 3 },
			{ index: 4 },
			{ index: 5 },
		];
		wheel.insertAll(items);

		// Items should be in slots based on index % slotCount
		expect(wheel.getSlot(0).length).toBe(2); // indices 0, 4
		expect(wheel.getSlot(1).length).toBe(2); // indices 1, 5
		expect(wheel.getSlot(2).length).toBe(1); // index 2
		expect(wheel.getSlot(3).length).toBe(1); // index 3
	});

	it('should advance slot on tick', () => {
		expect(wheel.current).toBe(0);
		wheel.tick();
		expect(wheel.current).toBe(1);
		wheel.tick();
		expect(wheel.current).toBe(2);
	});

	it('should wrap around slots', () => {
		// Create a fresh wheel for this test to ensure isolation
		const freshWheel = new TimeWheel<{ index: number }>(4);
		expect(freshWheel.current).toBe(0);
		
		// tick() advances AFTER returning items, so 4 ticks should wrap
		freshWheel.tick(); // now at 1
		freshWheel.tick(); // now at 2
		freshWheel.tick(); // now at 3
		freshWheel.tick(); // now at 0 (wrapped)
		expect(freshWheel.current).toBe(0);
	});

	it('should return items in current slot on tick', () => {
		wheel.insert({ index: 0 });
		wheel.insert({ index: 4 }); // Also slot 0

		const active = wheel.tick();
		expect(active.length).toBe(2);
	});

	it('should clear all slots', () => {
		wheel.insertAll([{ index: 0 }, { index: 1 }, { index: 2 }]);
		wheel.clear();

		expect(wheel.getSlot(0).length).toBe(0);
		expect(wheel.getSlot(1).length).toBe(0);
		expect(wheel.getSlot(2).length).toBe(0);
	});

	it('should check if item is active this frame', () => {
		const item0 = { index: 0 };
		const item1 = { index: 1 };

		wheel.insert(item0);
		wheel.insert(item1);

		// At slot 0, item0 is active
		expect(wheel.isActiveThisFrame(item0)).toBe(true);
		expect(wheel.isActiveThisFrame(item1)).toBe(false);

		wheel.tick(); // Move to slot 1
		expect(wheel.isActiveThisFrame(item0)).toBe(false);
		expect(wheel.isActiveThisFrame(item1)).toBe(true);
	});

	it('should promote item to current slot', () => {
		// Create fresh wheel for isolation
		const freshWheel = new TimeWheel<{ index: number }>(4);
		const item = { index: 5 }; // Would be in slot 1 (5 % 4 = 1)
		freshWheel.insert(item);

		// Initially in slot 1
		expect(freshWheel.getSlot(1)).toContain(item);

		// Promote to current slot (0)
		freshWheel.promote(item);
		expect(freshWheel.getSlot(0)).toContain(item);
	});
});

describe('TemporalDimension', () => {
	let dimension: TemporalDimension;
	let boids: BoidEntity[];

	beforeEach(() => {
		dimension = new TemporalDimension(4); // 4 slots
		boids = [];
		for (let i = 0; i < 8; i++) {
			boids.push(BoidEntity.createRandom(i, 100, 100, 1, 2));
		}
	});

	it('should start disabled', () => {
		expect(dimension.enabled).toBe(false);
	});

	it('should toggle enabled state', () => {
		dimension.enabled = true;
		expect(dimension.enabled).toBe(true);
	});

	it('should return all boids when disabled', () => {
		dimension.enabled = false;
		const active = dimension.getActiveBoidsThisFrame(boids);
		expect(active.length).toBe(8);
		expect(active).toBe(boids); // Same array reference
	});

	it('should return subset when enabled', () => {
		dimension.enabled = true;
		dimension.rebuild(boids);

		const active = dimension.getActiveBoidsThisFrame(boids);
		expect(active.length).toBeLessThan(boids.length);
	});

	it('should cycle through all boids over multiple frames', () => {
		dimension.enabled = true;
		dimension.rebuild(boids);

		const allActive = new Set<number>();

		// Run through 4 frames (one complete cycle)
		for (let frame = 0; frame < 4; frame++) {
			const active = dimension.getActiveBoidsThisFrame(boids);
			for (const boid of active) {
				allActive.add(boid.index);
			}
		}

		// All boids should have been active at least once
		expect(allActive.size).toBe(8);
	});

	it('should correctly identify full update status', () => {
		dimension.enabled = true;
		dimension.rebuild(boids);

		// Boid 0 should be in slot 0, so should update on first frame
		expect(dimension.shouldFullUpdate(boids[0]!)).toBe(true);

		// Boid 1 should be in slot 1, so should not update on first frame
		expect(dimension.shouldFullUpdate(boids[1]!)).toBe(false);
	});

	it('should interpolate position based on velocity', () => {
		dimension.enabled = true;

		const boid = boids[0]!;
		const startX = boid.x;
		const startY = boid.y;
		boid.velocity.set(10, 5);

		dimension.interpolate(boid, 2); // delta = 2

		expect(boid.x).toBe(startX + 20); // 10 * 2
		expect(boid.y).toBe(startY + 10); // 5 * 2
	});

	it('should not interpolate when disabled', () => {
		dimension.enabled = false;

		const boid = boids[0]!;
		const startX = boid.x;
		const startY = boid.y;
		boid.velocity.set(10, 5);

		dimension.interpolate(boid, 2);

		// Position should be unchanged
		expect(boid.x).toBe(startX);
		expect(boid.y).toBe(startY);
	});

	it('should return correct stats', () => {
		dimension.enabled = true;
		dimension.rebuild(boids);
		dimension.getActiveBoidsThisFrame(boids);

		const stats = dimension.getStats();
		expect(stats.fullUpdates).toBe(2); // 8 boids / 4 slots = 2 per slot
		expect(stats.interpolations).toBe(6); // 8 - 2
		expect(stats.ratio).toBe(4); // 4 slots
	});

	it('should return ratio of 1 when disabled', () => {
		dimension.enabled = false;
		dimension.getActiveBoidsThisFrame(boids);

		const stats = dimension.getStats();
		expect(stats.ratio).toBe(1);
	});

	it('should reset state', () => {
		dimension.enabled = true;
		dimension.rebuild(boids);
		dimension.getActiveBoidsThisFrame(boids);

		dimension.reset();

		const stats = dimension.getStats();
		expect(stats.fullUpdates).toBe(0);
		expect(stats.interpolations).toBe(0);
	});
});

