/**
 * Tests for MortonDimension - Morton code encoding/decoding and Z-order iteration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	mortonEncode,
	mortonDecode,
	MortonOrderedIndices,
	MortonDimension,
} from './MortonDimension.js';

describe('mortonEncode', () => {
	it('should encode (0, 0) as 0', () => {
		expect(mortonEncode(0, 0)).toBe(0);
	});

	it('should encode (1, 0) as 1 (x in even bits)', () => {
		expect(mortonEncode(1, 0)).toBe(1);
	});

	it('should encode (0, 1) as 2 (y in odd bits)', () => {
		expect(mortonEncode(0, 1)).toBe(2);
	});

	it('should encode (1, 1) as 3', () => {
		expect(mortonEncode(1, 1)).toBe(3);
	});

	it('should encode (2, 0) as 4', () => {
		expect(mortonEncode(2, 0)).toBe(4);
	});

	it('should encode (0, 2) as 8', () => {
		expect(mortonEncode(0, 2)).toBe(8);
	});

	it('should encode (2, 2) as 12', () => {
		expect(mortonEncode(2, 2)).toBe(12);
	});

	it('should handle larger values', () => {
		const code = mortonEncode(100, 50);
		expect(code).toBeGreaterThan(0);
	});
});

describe('mortonDecode', () => {
	it('should decode 0 as (0, 0)', () => {
		expect(mortonDecode(0)).toEqual([0, 0]);
	});

	it('should decode 1 as (1, 0)', () => {
		expect(mortonDecode(1)).toEqual([1, 0]);
	});

	it('should decode 2 as (0, 1)', () => {
		expect(mortonDecode(2)).toEqual([0, 1]);
	});

	it('should decode 3 as (1, 1)', () => {
		expect(mortonDecode(3)).toEqual([1, 1]);
	});

	it('should be inverse of encode', () => {
		for (let x = 0; x < 16; x++) {
			for (let y = 0; y < 16; y++) {
				const code = mortonEncode(x, y);
				const [dx, dy] = mortonDecode(code);
				expect(dx).toBe(x);
				expect(dy).toBe(y);
			}
		}
	});
});

describe('MortonOrderedIndices', () => {
	let indices: MortonOrderedIndices;

	beforeEach(() => {
		indices = new MortonOrderedIndices();
	});

	it('should build indices for a 2x2 grid', () => {
		indices.rebuild(2, 2);
		expect(indices.length).toBe(4);
	});

	it('should build indices for a 4x4 grid', () => {
		indices.rebuild(4, 4);
		expect(indices.length).toBe(16);
	});

	it('should return indices in Morton order', () => {
		indices.rebuild(2, 2);
		const order = indices.getIndices();

		// First cell should be (0, 0)
		expect(order[0]).toEqual([0, 0]);

		// All cells should be unique
		const seen = new Set<string>();
		for (const [row, col] of order) {
			const key = `${row},${col}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});

	it('should not rebuild if dimensions unchanged', () => {
		indices.rebuild(4, 4);
		const first = indices.getIndices();
		indices.rebuild(4, 4);
		const second = indices.getIndices();
		expect(first).toBe(second); // Same reference
	});

	it('should rebuild if dimensions change', () => {
		indices.rebuild(2, 2);
		expect(indices.length).toBe(4);
		indices.rebuild(4, 4);
		expect(indices.length).toBe(16);
	});
});

describe('MortonDimension', () => {
	let dimension: MortonDimension;

	beforeEach(() => {
		dimension = new MortonDimension();
	});

	it('should start disabled', () => {
		expect(dimension.enabled).toBe(false);
	});

	it('should toggle enabled state', () => {
		dimension.enabled = true;
		expect(dimension.enabled).toBe(true);
		dimension.enabled = false;
		expect(dimension.enabled).toBe(false);
	});

	it('should return null iteration order when disabled', () => {
		dimension.enabled = false;
		expect(dimension.getIterationOrder()).toBeNull();
	});

	it('should return Morton order when enabled', () => {
		dimension.enabled = true;
		dimension.updateGridSize(4, 4);
		const order = dimension.getIterationOrder();
		expect(order).not.toBeNull();
		expect(order!.length).toBe(16);
	});

	it('should iterate in row-major order when disabled', () => {
		dimension.enabled = false;
		const visited: [number, number][] = [];
		dimension.iterate(2, 2, (row, col) => {
			visited.push([row, col]);
		});

		expect(visited).toEqual([
			[0, 0],
			[0, 1],
			[1, 0],
			[1, 1],
		]);
	});

	it('should iterate in Morton order when enabled', () => {
		dimension.enabled = true;
		dimension.updateGridSize(2, 2);
		const visited: [number, number][] = [];
		dimension.iterate(2, 2, (row, col) => {
			visited.push([row, col]);
		});

		// Should visit all cells exactly once
		expect(visited.length).toBe(4);
		const unique = new Set(visited.map(([r, c]) => `${r},${c}`));
		expect(unique.size).toBe(4);
	});

	it('should estimate cache improvement for larger grids', () => {
		dimension.enabled = true;
		const improvement = dimension.estimateCacheImprovement(16, 16);
		expect(improvement).toBeGreaterThan(0);
		expect(improvement).toBeLessThanOrEqual(50);
	});

	it('should return 0 cache improvement when disabled', () => {
		dimension.enabled = false;
		const improvement = dimension.estimateCacheImprovement(16, 16);
		expect(improvement).toBe(0);
	});

	it('should reset state', () => {
		dimension.enabled = true;
		dimension.estimateCacheImprovement(16, 16);
		dimension.reset();
		// After reset, internal state should be cleared
		expect(dimension.estimateCacheImprovement(4, 4)).toBeGreaterThan(0);
	});
});

