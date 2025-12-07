/**
 * Tests for FlowDimension - Flow fields for environmental forces.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FlowField, FlowDimension } from './FlowDimension.js';
import { V2D } from '../../math/V2D.js';

describe('FlowField', () => {
	let field: FlowField;

	beforeEach(() => {
		field = new FlowField(50, 200, 200); // 50px cells, 200x200 world = 4x4 grid
	});

	describe('construction', () => {
		it('should create grid with correct dimensions', () => {
			expect(field.gridCols).toBe(4);
			expect(field.gridRows).toBe(4);
			expect(field.gridCellSize).toBe(50);
		});

		it('should initialize all cells with zero vectors', () => {
			for (let row = 0; row < 4; row++) {
				for (let col = 0; col < 4; col++) {
					const force = field.getCellForce(row, col);
					expect(force).not.toBeNull();
					expect(force!.x).toBe(0);
					expect(force!.y).toBe(0);
				}
			}
		});
	});

	describe('sample', () => {
		it('should sample at correct cell', () => {
			// Add force to cell (0, 0)
			const cell = field.getCellForce(0, 0);
			cell!.x = 5;
			cell!.y = 10;

			const sampled = field.sample(25, 25); // Center of cell (0, 0)
			expect(sampled.x).toBe(5);
			expect(sampled.y).toBe(10);
		});

		it('should clamp to grid bounds', () => {
			// Sample outside grid should clamp
			const sampled = field.sample(500, 500);
			expect(sampled).not.toBeNull();
		});
	});

	describe('sampleSmooth', () => {
		it('should interpolate between cells', () => {
			// Set up adjacent cells with different values
			const cell00 = field.getCellForce(0, 0);
			const cell01 = field.getCellForce(0, 1);
			cell00!.x = 0;
			cell01!.x = 10;

			// Sample at boundary between cells
			const sampled = field.sampleSmooth(50, 25); // x=50 is boundary
			expect(sampled.x).toBeGreaterThan(0);
			expect(sampled.x).toBeLessThan(10);
		});
	});

	describe('addWind', () => {
		it('should add uniform force to all cells', () => {
			const freshField = new FlowField(50, 200, 200);
			freshField.addWind(0, 5); // Rightward wind, strength 5

			for (let row = 0; row < 4; row++) {
				for (let col = 0; col < 4; col++) {
					const force = freshField.getCellForce(row, col);
					expect(force!.x).toBeCloseTo(5, 2);
					expect(force!.y).toBeCloseTo(0, 2);
				}
			}
		});

		it('should respect wind direction', () => {
			const freshField = new FlowField(50, 200, 200);
			freshField.addWind(Math.PI / 2, 5); // Downward wind

			const force = freshField.getCellForce(0, 0);
			expect(force!.x).toBeCloseTo(0, 2);
			expect(force!.y).toBeCloseTo(5, 2);
		});
	});

	describe('addThermal', () => {
		it('should add upward force in thermal area', () => {
			const freshField = new FlowField(50, 200, 200);
			freshField.addThermal(100, 100, 75, 1); // Center of grid, radius 75

			// Center cell should have upward force
			const centerForce = freshField.getCellForce(2, 2); // Cell at (100, 100)
			expect(centerForce!.y).toBeLessThan(0); // Negative Y is up
		});

		it('should not affect cells outside radius', () => {
			const freshField = new FlowField(50, 200, 200);
			freshField.addThermal(25, 25, 30, 1); // Small thermal in corner

			// Far corner should be unaffected
			const farForce = freshField.getCellForce(3, 3);
			expect(farForce!.x).toBeCloseTo(0, 2);
			expect(farForce!.y).toBeCloseTo(0, 2);
		});
	});

	describe('addVortex', () => {
		it('should add rotational force', () => {
			field.addVortex(100, 100, 75, 1, true); // Clockwise vortex

			// Check that forces are tangential to radius
			const force = field.getCellForce(2, 1); // Left of center
			expect(force!.x !== 0 || force!.y !== 0).toBe(true);
		});
	});

	describe('addTurbulence', () => {
		it('should add non-zero forces', () => {
			field.addTurbulence(0.5);

			let hasNonZero = false;
			for (let row = 0; row < 4; row++) {
				for (let col = 0; col < 4; col++) {
					const force = field.getCellForce(row, col);
					if (force!.x !== 0 || force!.y !== 0) {
						hasNonZero = true;
					}
				}
			}
			expect(hasNonZero).toBe(true);
		});
	});

	describe('clear', () => {
		it('should reset all cells to zero', () => {
			field.addWind(0, 5);
			field.clear();

			for (let row = 0; row < 4; row++) {
				for (let col = 0; col < 4; col++) {
					const force = field.getCellForce(row, col);
					expect(force!.x).toBe(0);
					expect(force!.y).toBe(0);
				}
			}
		});
	});
});

describe('FlowDimension', () => {
	let dimension: FlowDimension;

	beforeEach(() => {
		dimension = new FlowDimension();
	});

	it('should start disabled', () => {
		expect(dimension.enabled).toBe(false);
	});

	it('should toggle enabled state', () => {
		dimension.enabled = true;
		expect(dimension.enabled).toBe(true);
	});

	it('should have default strength of 0.1', () => {
		expect(dimension.strength).toBe(0.1);
	});

	it('should clamp strength to non-negative', () => {
		dimension.strength = -1;
		expect(dimension.strength).toBe(0);
	});

	it('should return null flow field before initialization', () => {
		expect(dimension.getFlowField()).toBeNull();
	});

	it('should create flow field on initialize', () => {
		dimension.initialize(200, 200, 50);
		expect(dimension.getFlowField()).not.toBeNull();
	});

	describe('when initialized', () => {
		beforeEach(() => {
			dimension.initialize(200, 200, 50);
		});

		it('should return zero vector when disabled', () => {
			dimension.enabled = false;
			dimension.beginFrame();

			const force = dimension.sample(100, 100);
			expect(force.x).toBe(0);
			expect(force.y).toBe(0);
		});

		it('should sample flow field when enabled', () => {
			dimension.enabled = true;
			dimension.setWind(0, 1); // Rightward wind

			dimension.beginFrame();
			const force = dimension.sample(100, 100);

			expect(force.x).toBeGreaterThan(0);
		});

		it('should scale force by strength', () => {
			dimension.enabled = true;
			dimension.strength = 0.5;
			dimension.setWind(0, 2);

			dimension.beginFrame();
			const force = dimension.sample(100, 100);

			expect(force.x).toBeCloseTo(1, 1); // 2 * 0.5
		});

		it('should apply force to acceleration vector', () => {
			dimension.enabled = true;
			dimension.strength = 1.0;
			dimension.setWind(0, 5);

			const acceleration = new V2D(0, 0);
			dimension.beginFrame();
			dimension.applyToAcceleration(100, 100, acceleration);

			expect(acceleration.x).toBeCloseTo(5, 1);
		});

		it('should not apply force when disabled', () => {
			dimension.enabled = false;
			dimension.setWind(0, 5);

			const acceleration = new V2D(0, 0);
			dimension.beginFrame();
			dimension.applyToAcceleration(100, 100, acceleration);

			expect(acceleration.x).toBe(0);
			expect(acceleration.y).toBe(0);
		});

		it('should track sample count', () => {
			dimension.enabled = true;
			dimension.beginFrame();

			dimension.sample(50, 50);
			dimension.sample(100, 100);
			dimension.sample(150, 150);

			const stats = dimension.getStats();
			expect(stats.samples).toBe(3);
		});

		it('should reset sample count on beginFrame', () => {
			dimension.enabled = true;
			dimension.beginFrame();
			dimension.sample(50, 50);

			dimension.beginFrame(); // New frame

			const stats = dimension.getStats();
			expect(stats.samples).toBe(0);
		});

		it('should rebuild field with wind settings', () => {
			dimension.setWind(Math.PI, 2); // Leftward wind

			const force = dimension.getFlowField()!.sample(100, 100);
			expect(force.x).toBeLessThan(0);
		});

		it('should add turbulence', () => {
			dimension.setTurbulence(true, 0.5);

			const stats = dimension.getStats();
			expect(stats.hasTurbulence).toBe(true);
		});

		it('should add thermal', () => {
			dimension.addThermal(100, 100, 50, 1);

			const force = dimension.getFlowField()!.sample(100, 100);
			expect(force.y).toBeLessThan(0); // Upward
		});

		it('should add vortex', () => {
			dimension.addVortex(100, 100, 50, 1, true);

			// Force should be non-zero near vortex
			const force = dimension.getFlowField()!.sample(75, 100);
			expect(force.x !== 0 || force.y !== 0).toBe(true);
		});

		it('should reset state', () => {
			dimension.enabled = true;
			dimension.setWind(0, 5);
			dimension.beginFrame();
			dimension.sample(100, 100);

			dimension.reset();

			const stats = dimension.getStats();
			expect(stats.samples).toBe(0);
		});
	});
});

