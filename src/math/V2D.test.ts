/**
 * Unit tests for V2D vector class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { V2D } from './V2D.js';

describe('V2D', () => {
	describe('constructor', () => {
		it('should create a zero vector by default', () => {
			const v = new V2D();
			expect(v.x).toBe(0);
			expect(v.y).toBe(0);
		});

		it('should create a vector with given components', () => {
			const v = new V2D(3, 4);
			expect(v.x).toBe(3);
			expect(v.y).toBe(4);
		});
	});

	describe('static factory methods', () => {
		it('should create from array', () => {
			const v = V2D.fromArray([5, 6]);
			expect(v.x).toBe(5);
			expect(v.y).toBe(6);
		});

		it('should create from object', () => {
			const v = V2D.fromObject({ x: 7, y: 8 });
			expect(v.x).toBe(7);
			expect(v.y).toBe(8);
		});

		it('should create random vector with correct magnitude', () => {
			const v = V2D.random(5);
			expect(v.mag()).toBeCloseTo(5, 5);
		});
	});

	describe('static operations', () => {
		it('should add two vectors', () => {
			const result = V2D.add({ x: 1, y: 2 }, { x: 3, y: 4 });
			expect(result.x).toBe(4);
			expect(result.y).toBe(6);
		});

		it('should subtract two vectors', () => {
			const result = V2D.sub({ x: 5, y: 7 }, { x: 2, y: 3 });
			expect(result.x).toBe(3);
			expect(result.y).toBe(4);
		});

		it('should multiply by scalar', () => {
			const result = V2D.mult({ x: 2, y: 3 }, 4);
			expect(result.x).toBe(8);
			expect(result.y).toBe(12);
		});

		it('should divide by scalar', () => {
			const result = V2D.div({ x: 8, y: 12 }, 4);
			expect(result.x).toBe(2);
			expect(result.y).toBe(3);
		});

		it('should calculate dot product', () => {
			const dot = V2D.dot({ x: 1, y: 2 }, { x: 3, y: 4 });
			expect(dot).toBe(11); // 1*3 + 2*4
		});

		it('should calculate squared distance', () => {
			const sqrDist = V2D.sqrDist({ x: 0, y: 0 }, { x: 3, y: 4 });
			expect(sqrDist).toBe(25); // 3² + 4²
		});

		it('should calculate distance', () => {
			const dist = V2D.dist({ x: 0, y: 0 }, { x: 3, y: 4 });
			expect(dist).toBe(5);
		});

		it('should lerp between vectors', () => {
			const result = V2D.lerp({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5);
			expect(result.x).toBe(5);
			expect(result.y).toBe(10);
		});
	});

	describe('conversion methods', () => {
		let v: V2D;

		beforeEach(() => {
			v = new V2D(3, 4);
		});

		it('should convert to string', () => {
			expect(v.toString()).toBe('3,4');
		});

		it('should convert to array', () => {
			expect(v.toArray()).toEqual([3, 4]);
		});

		it('should convert to object', () => {
			expect(v.toObject()).toEqual({ x: 3, y: 4 });
		});
	});

	describe('setter methods', () => {
		let v: V2D;

		beforeEach(() => {
			v = new V2D(1, 2);
		});

		it('should set components', () => {
			v.set(5, 6);
			expect(v.x).toBe(5);
			expect(v.y).toBe(6);
		});

		it('should copy from another vector', () => {
			v.copy({ x: 7, y: 8 });
			expect(v.x).toBe(7);
			expect(v.y).toBe(8);
		});

		it('should clone to new vector', () => {
			const clone = v.clone();
			expect(clone.x).toBe(v.x);
			expect(clone.y).toBe(v.y);
			expect(clone).not.toBe(v);
		});
	});

	describe('scalar properties', () => {
		it('should calculate angle', () => {
			const v = new V2D(1, 0);
			expect(v.angle()).toBe(0);

			const v2 = new V2D(0, 1);
			expect(v2.angle()).toBeCloseTo(Math.PI / 2, 5);
		});

		it('should calculate squared magnitude', () => {
			const v = new V2D(3, 4);
			expect(v.sqrMag()).toBe(25);
		});

		it('should calculate magnitude', () => {
			const v = new V2D(3, 4);
			expect(v.mag()).toBe(5);
		});

		it('should calculate squared distance to another vector', () => {
			const v = new V2D(0, 0);
			expect(v.sqrDist({ x: 3, y: 4 })).toBe(25);
		});

		it('should calculate distance to another vector', () => {
			const v = new V2D(0, 0);
			expect(v.dist({ x: 3, y: 4 })).toBe(5);
		});

		it('should calculate dot product with another vector', () => {
			const v = new V2D(1, 2);
			expect(v.dot({ x: 3, y: 4 })).toBe(11);
		});
	});

	describe('unary operations', () => {
		it('should zero the vector', () => {
			const v = new V2D(3, 4);
			v.zero();
			expect(v.x).toBe(0);
			expect(v.y).toBe(0);
		});

		it('should normalize to unit length', () => {
			const v = new V2D(3, 4);
			v.normalize();
			expect(v.mag()).toBeCloseTo(1, 5);
		});

		it('should handle normalizing zero vector', () => {
			const v = new V2D(0, 0);
			v.normalize();
			expect(v.x).toBe(0);
			expect(v.y).toBe(0);
		});

		it('should negate components', () => {
			const v = new V2D(3, -4);
			v.negate();
			expect(v.x).toBe(-3);
			expect(v.y).toBe(4);
		});
	});

	describe('scalar operations', () => {
		it('should set random direction with magnitude', () => {
			const v = new V2D();
			v.random(10);
			expect(v.mag()).toBeCloseTo(10, 5);
		});

		it('should rotate by angle', () => {
			const v = new V2D(1, 0);
			v.rotate(Math.PI / 2);
			expect(v.x).toBeCloseTo(0, 5);
			expect(v.y).toBeCloseTo(1, 5);
		});

		it('should multiply by scalar', () => {
			const v = new V2D(2, 3);
			v.mult(2);
			expect(v.x).toBe(4);
			expect(v.y).toBe(6);
		});

		it('should divide by scalar', () => {
			const v = new V2D(4, 6);
			v.div(2);
			expect(v.x).toBe(2);
			expect(v.y).toBe(3);
		});

		it('should set magnitude', () => {
			const v = new V2D(3, 4);
			v.setMag(10);
			expect(v.mag()).toBeCloseTo(10, 5);
		});

		it('should limit to max magnitude', () => {
			const v = new V2D(30, 40); // mag = 50
			v.max(10);
			expect(v.mag()).toBeCloseTo(10, 5);
		});

		it('should not change if below max', () => {
			const v = new V2D(3, 4); // mag = 5
			v.max(10);
			expect(v.mag()).toBeCloseTo(5, 5);
		});

		it('should ensure min magnitude', () => {
			const v = new V2D(0.3, 0.4); // mag = 0.5
			v.min(5);
			expect(v.mag()).toBeCloseTo(5, 5);
		});

		it('should not change if above min', () => {
			const v = new V2D(30, 40); // mag = 50
			v.min(5);
			expect(v.mag()).toBeCloseTo(50, 5);
		});
	});

	describe('vector operations', () => {
		it('should add another vector', () => {
			const v = new V2D(1, 2);
			v.add({ x: 3, y: 4 });
			expect(v.x).toBe(4);
			expect(v.y).toBe(6);
		});

		it('should subtract another vector', () => {
			const v = new V2D(5, 7);
			v.sub({ x: 2, y: 3 });
			expect(v.x).toBe(3);
			expect(v.y).toBe(4);
		});

		it('should add scaled vector', () => {
			const v = new V2D(1, 1);
			v.sclAdd({ x: 2, y: 3 }, 2);
			expect(v.x).toBe(5); // 1 + 2*2
			expect(v.y).toBe(7); // 1 + 3*2
		});

		it('should lerp toward another vector', () => {
			const v = new V2D(0, 0);
			v.lerp({ x: 10, y: 20 }, 0.5);
			expect(v.x).toBe(5);
			expect(v.y).toBe(10);
		});
	});

	describe('method chaining', () => {
		it('should support chaining multiple operations', () => {
			const v = new V2D(1, 0);
			v.mult(5).rotate(Math.PI / 2).add({ x: 1, y: 1 });

			expect(v.x).toBeCloseTo(1, 5);
			expect(v.y).toBeCloseTo(6, 5);
		});
	});
});

