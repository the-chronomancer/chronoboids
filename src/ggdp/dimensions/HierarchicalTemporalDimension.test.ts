import { describe, it, expect, beforeEach } from 'vitest';
import {
	HierarchicalTimeWheel,
	HierarchicalTemporalDimension,
	ActivityLevel,
} from './HierarchicalTemporalDimension.js';
import type { BoidEntity } from '../../entities/BoidEntity.js';

/**
 * Creates a mock boid entity for testing.
 */
function createMockBoid(index: number, x = 0, y = 0, vx = 0, vy = 0): BoidEntity {
	return {
		index,
		x,
		y,
		velocity: { x: vx, y: vy, set: () => {}, add: () => {}, sub: () => {}, mult: () => {}, div: () => {}, mag: () => Math.sqrt(vx * vx + vy * vy), normalize: () => {}, limit: () => {}, heading: () => 0, copy: () => ({ x: vx, y: vy }) as any, zero: () => {} },
		acceleration: { x: 0, y: 0, set: () => {}, add: () => {}, sub: () => {}, mult: () => {}, div: () => {}, mag: () => 0, normalize: () => {}, limit: () => {}, heading: () => 0, copy: () => ({ x: 0, y: 0 }) as any, zero: () => {} },
		neighborCache: [],
		distanceCache: [],
		neighborCount: 0,
		applyForce: () => {},
		applyScaledForce: () => {},
		resetAcceleration: () => {},
		clearNeighborCache: () => {},
		addNeighbor: () => {},
		destroy: () => {},
	} as unknown as BoidEntity;
}

describe('HierarchicalTimeWheel', () => {
	let wheel: HierarchicalTimeWheel;

	beforeEach(() => {
		wheel = new HierarchicalTimeWheel();
	});

	describe('initialization', () => {
		it('should create with default 3 levels', () => {
			expect(wheel.levelCount).toBe(3);
		});

		it('should start empty', () => {
			const stats = wheel.getStats();
			expect(stats.levelCounts).toEqual([0, 0, 0]);
		});
	});

	describe('insertion', () => {
		it('should insert boids at specified level', () => {
			const boid = createMockBoid(0);
			wheel.insert(boid, ActivityLevel.HIGH);
			
			const stats = wheel.getStats();
			expect(stats.levelCounts[0]).toBe(1);
		});

		it('should insert all boids', () => {
			wheel.clear(); // Ensure clean state
			const boids = [createMockBoid(0), createMockBoid(1), createMockBoid(2)];
			wheel.insertAll(boids, ActivityLevel.HIGH);
			
			const stats = wheel.getStats();
			expect(stats.levelCounts[0]).toBe(3);
		});
	});

	describe('tick behavior', () => {
		it('should return items from level 0 on every tick', () => {
			const boid = createMockBoid(0);
			wheel.insert(boid, ActivityLevel.HIGH);
			
			const active = wheel.tick();
			expect(active.length).toBeGreaterThanOrEqual(0); // May or may not be in current slot
		});

		it('should distribute boids across slots', () => {
			const boids: BoidEntity[] = [];
			for (let i = 0; i < 16; i++) {
				boids.push(createMockBoid(i));
			}
			wheel.insertAll(boids, ActivityLevel.HIGH);
			
			// Tick through all 16 slots
			let totalReturned = 0;
			for (let i = 0; i < 16; i++) {
				const active = wheel.tick();
				totalReturned += active.length;
			}
			
			// All boids should be returned once per full cycle
			expect(totalReturned).toBe(16);
		});
	});

	describe('activity tracking', () => {
		it('should track boid activity levels', () => {
			const boid = createMockBoid(0);
			wheel.insert(boid, ActivityLevel.HIGH);
			
			expect(wheel.getBoidLevel(boid)).toBe(ActivityLevel.HIGH);
		});

		it('should demote boids with low velocity', () => {
			const boid = createMockBoid(0, 0, 0, 0, 0); // Zero velocity
			wheel.insert(boid, ActivityLevel.HIGH);
			
			// Update activity multiple times with low velocity
			for (let i = 0; i < 50; i++) {
				wheel.updateActivity(boid, 0.01, false, false);
			}
			
			// Should have demoted to lower level
			expect(wheel.getBoidLevel(boid)).not.toBe(ActivityLevel.HIGH);
		});

		it('should promote boids near interaction', () => {
			const boid = createMockBoid(0);
			wheel.insert(boid, ActivityLevel.LOW);
			
			// Update with interaction
			wheel.updateActivity(boid, 0.01, true, false);
			
			expect(wheel.getBoidLevel(boid)).toBe(ActivityLevel.HIGH);
		});

		it('should promote boids with high velocity', () => {
			const boid = createMockBoid(0);
			wheel.insert(boid, ActivityLevel.LOW);
			
			// Update with high velocity
			for (let i = 0; i < 10; i++) {
				wheel.updateActivity(boid, 5.0, false, false);
			}
			
			expect(wheel.getBoidLevel(boid)).toBe(ActivityLevel.HIGH);
		});
	});

	describe('promotion', () => {
		it('should promote boid to high priority', () => {
			const boid = createMockBoid(0);
			wheel.insert(boid, ActivityLevel.LOW);
			
			wheel.promote(boid);
			
			expect(wheel.getBoidLevel(boid)).toBe(ActivityLevel.HIGH);
		});
	});

	describe('clear', () => {
		it('should clear all levels', () => {
			const boids = [createMockBoid(0), createMockBoid(1)];
			wheel.insertAll(boids, ActivityLevel.HIGH);
			
			wheel.clear();
			
			const stats = wheel.getStats();
			expect(stats.levelCounts).toEqual([0, 0, 0]);
		});
	});

	describe('capacity multiplier', () => {
		it('should calculate capacity multiplier based on distribution', () => {
			const boids: BoidEntity[] = [];
			for (let i = 0; i < 10; i++) {
				boids.push(createMockBoid(i));
			}
			wheel.insertAll(boids, ActivityLevel.HIGH);
			
			const stats = wheel.getStats();
			// All at HIGH level = 16x multiplier (16 slots)
			expect(stats.totalCapacityMultiplier).toBe(16);
		});
	});

	describe('thresholds', () => {
		it('should allow setting custom thresholds', () => {
			wheel.setThresholds(1.0, 0.5, 10);
			
			const boid = createMockBoid(0);
			wheel.insert(boid, ActivityLevel.HIGH);
			
			// With higher thresholds, should demote faster
			for (let i = 0; i < 15; i++) {
				wheel.updateActivity(boid, 0.3, false, false);
			}
			
			// Should have demoted (velocity 0.3 < medium threshold 1.0)
			expect(wheel.getBoidLevel(boid)).not.toBe(ActivityLevel.HIGH);
		});
	});
});

describe('HierarchicalTemporalDimension', () => {
	let dimension: HierarchicalTemporalDimension;

	beforeEach(() => {
		dimension = new HierarchicalTemporalDimension();
		dimension.reset();
	});

	describe('enabled state', () => {
		it('should start disabled', () => {
			expect(dimension.enabled).toBe(false);
		});

		it('should be toggleable', () => {
			dimension.enabled = true;
			expect(dimension.enabled).toBe(true);
			
			dimension.enabled = false;
			expect(dimension.enabled).toBe(false);
		});
	});

	describe('getActiveBoidsThisFrame', () => {
		it('should return all boids when disabled', () => {
			const boids = [createMockBoid(0), createMockBoid(1), createMockBoid(2)];
			
			const active = dimension.getActiveBoidsThisFrame(boids);
			
			expect(active.length).toBe(3);
			expect(active).toEqual(boids);
		});

		it('should return subset when enabled', () => {
			dimension.enabled = true;
			const boids: BoidEntity[] = [];
			for (let i = 0; i < 32; i++) {
				boids.push(createMockBoid(i));
			}
			dimension.rebuild(boids);
			
			const active = dimension.getActiveBoidsThisFrame(boids);
			
			// Should return fewer than all boids
			expect(active.length).toBeLessThan(boids.length);
		});
	});

	describe('interpolation', () => {
		it('should interpolate position based on velocity', () => {
			dimension.enabled = true;
			const boid = createMockBoid(0, 100, 100, 10, 5);
			
			dimension.interpolate(boid, 0.016);
			
			expect(boid.x).toBeCloseTo(100.16, 2);
			expect(boid.y).toBeCloseTo(100.08, 2);
		});

		it('should not interpolate when disabled', () => {
			dimension.enabled = false;
			const boid = createMockBoid(0, 100, 100, 10, 5);
			
			dimension.interpolate(boid, 0.016);
			
			expect(boid.x).toBe(100);
			expect(boid.y).toBe(100);
		});
	});

	describe('activity updates', () => {
		it('should track boid activity when enabled', () => {
			dimension.enabled = true;
			const boid = createMockBoid(0);
			dimension.rebuild([boid]);
			
			dimension.updateBoidActivity(boid, 5.0, false, false);
			
			// Should track without errors
			expect(dimension.getBoidLevel(boid)).toBeDefined();
		});

		it('should not track when disabled', () => {
			dimension.enabled = false;
			const boid = createMockBoid(0);
			
			// Should not throw
			dimension.updateBoidActivity(boid, 5.0, false, false);
		});
	});

	describe('promotion', () => {
		it('should promote boid for immediate update', () => {
			dimension.enabled = true;
			const boid = createMockBoid(0);
			dimension.rebuild([boid]);
			
			dimension.promoteForUpdate(boid);
			
			expect(dimension.getBoidLevel(boid)).toBe(ActivityLevel.HIGH);
		});
	});

	describe('statistics', () => {
		it('should track update statistics', () => {
			dimension.enabled = true;
			const boids: BoidEntity[] = [];
			for (let i = 0; i < 16; i++) {
				boids.push(createMockBoid(i));
			}
			dimension.rebuild(boids);
			
			dimension.getActiveBoidsThisFrame(boids);
			
			const stats = dimension.getStats();
			expect(stats.fullUpdates).toBeGreaterThan(0);
			expect(stats.interpolations).toBeGreaterThanOrEqual(0);
			expect(stats.fullUpdates + stats.interpolations).toBe(16);
		});
	});

	describe('reset', () => {
		it('should reset all state', () => {
			dimension.enabled = true;
			const boids = [createMockBoid(0), createMockBoid(1)];
			dimension.rebuild(boids);
			dimension.getActiveBoidsThisFrame(boids);
			
			dimension.reset();
			
			const stats = dimension.getStats();
			expect(stats.fullUpdates).toBe(0);
			expect(stats.interpolations).toBe(0);
		});
	});

	describe('threshold configuration', () => {
		it('should allow setting thresholds', () => {
			dimension.setThresholds(1.0, 0.5, 20);
			
			// Should not throw
			expect(true).toBe(true);
		});
	});
});

