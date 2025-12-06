/**
 * Unit tests for SpatialHash class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialHash, type Spatial } from './SpatialHash.js';

// Simple test object implementing Spatial interface
interface TestItem extends Spatial {
	x: number;
	y: number;
	index: number;
	name: string;
}

function createItem(index: number, x: number, y: number): TestItem {
	return { index, x, y, name: `item-${String(index)}` };
}

describe('SpatialHash', () => {
	let hash: SpatialHash<TestItem>;

	beforeEach(() => {
		// 100x100 world with 10x10 cells
		hash = new SpatialHash<TestItem>(10, 100, 100);
	});

	describe('constructor', () => {
		it('should create a spatial hash with correct dimensions', () => {
			expect(hash.gridCellSize).toBe(10);
			expect(hash.gridCols).toBe(10);
			expect(hash.gridRows).toBe(10);
		});

		it('should handle non-divisible dimensions', () => {
			const h = new SpatialHash<TestItem>(15, 100, 100);
			expect(h.gridCols).toBe(7); // ceil(100/15)
			expect(h.gridRows).toBe(7);
		});
	});

	describe('insert', () => {
		it('should insert an item', () => {
			const item = createItem(0, 5, 5);
			hash.insert(item);
			expect(hash.activeCellCount).toBe(1);
		});

		it('should insert multiple items into same cell', () => {
			hash.insert(createItem(0, 5, 5));
			hash.insert(createItem(1, 6, 6));
			expect(hash.activeCellCount).toBe(1);
		});

		it('should insert items into different cells', () => {
			hash.insert(createItem(0, 5, 5)); // Cell (0,0)
			hash.insert(createItem(1, 15, 5)); // Cell (0,1)
			hash.insert(createItem(2, 5, 15)); // Cell (1,0)
			expect(hash.activeCellCount).toBe(3);
		});
	});

	describe('insertAll', () => {
		it('should insert all items', () => {
			const items = [createItem(0, 5, 5), createItem(1, 25, 25), createItem(2, 45, 45)];
			hash.insertAll(items);
			expect(hash.activeCellCount).toBe(3);
		});
	});

	describe('clear', () => {
		it('should clear all items', () => {
			hash.insert(createItem(0, 5, 5));
			hash.insert(createItem(1, 25, 25));
			hash.clear();
			expect(hash.activeCellCount).toBe(0);
		});

		it('should allow reinsertion after clear', () => {
			hash.insert(createItem(0, 5, 5));
			hash.clear();
			hash.insert(createItem(1, 15, 15));
			expect(hash.activeCellCount).toBe(1);
		});
	});

	describe('queryNearby', () => {
		it('should return items in same cell', () => {
			const item = createItem(0, 5, 5);
			hash.insert(item);

			const results = hash.queryNearby(5, 5);
			const flatResults = results.flat();

			expect(flatResults).toContain(item);
		});

		it('should return items in adjacent cells', () => {
			// Use larger hash to avoid wrapping effects
			const largeHash = new SpatialHash<TestItem>(10, 200, 200);

			// Insert items in a 3x3 pattern around center (cells 5,5 area)
			const items = [
				createItem(0, 55, 55), // Center
				createItem(1, 45, 45), // Top-left
				createItem(2, 55, 45), // Top
				createItem(3, 65, 45), // Top-right
				createItem(4, 45, 55), // Left
				createItem(5, 65, 55), // Right
				createItem(6, 45, 65), // Bottom-left
				createItem(7, 55, 65), // Bottom
				createItem(8, 65, 65), // Bottom-right
			];

			largeHash.insertAll(items);

			// Query from center should find all 9 items
			const results = largeHash.queryNearby(55, 55);
			const flatResults = results.flat();

			expect(flatResults.length).toBe(9);
			for (const item of items) {
				expect(flatResults).toContain(item);
			}
		});

		it('should not return items from non-adjacent cells (without wrapping)', () => {
			// Use larger hash to avoid wrapping
			const largeHash = new SpatialHash<TestItem>(10, 200, 200);

			const nearItem = createItem(0, 55, 55);
			const farItem = createItem(1, 155, 155); // Far enough to not wrap

			largeHash.insert(nearItem);
			largeHash.insert(farItem);

			const results = largeHash.queryNearby(55, 55);
			const flatResults = results.flat();

			expect(flatResults).toContain(nearItem);
			expect(flatResults).not.toContain(farItem);
		});

		it('should handle empty cells', () => {
			const results = hash.queryNearby(50, 50);
			expect(results.length).toBe(0);
		});
	});

	describe('countNearby', () => {
		it('should count items in nearby cells', () => {
			// Use larger hash to avoid wrapping
			const largeHash = new SpatialHash<TestItem>(10, 200, 200);
			largeHash.insert(createItem(0, 55, 55));
			largeHash.insert(createItem(1, 56, 56));
			largeHash.insert(createItem(2, 65, 55));

			const count = largeHash.countNearby(55, 55);
			expect(count).toBe(3);
		});

		it('should return 0 for empty area', () => {
			const count = hash.countNearby(50, 50);
			expect(count).toBe(0);
		});
	});

	describe('getCell', () => {
		it('should return items in specific cell', () => {
			const item = createItem(0, 5, 5);
			hash.insert(item);

			const cell = hash.getCell(0, 0);
			expect(cell).toContain(item);
		});

		it('should return empty array for empty cell', () => {
			const cell = hash.getCell(5, 5);
			expect(cell.length).toBe(0);
		});
	});

	describe('resize', () => {
		it('should return false if dimensions unchanged', () => {
			const changed = hash.resize(10, 100, 100);
			expect(changed).toBe(false);
		});

		it('should return true and clear on resize', () => {
			hash.insert(createItem(0, 5, 5));
			const changed = hash.resize(20, 100, 100);

			expect(changed).toBe(true);
			expect(hash.gridCellSize).toBe(20);
			expect(hash.activeCellCount).toBe(0);
		});
	});

	describe('edge cases', () => {
		it('should handle items at cell boundaries', () => {
			// Item exactly on cell boundary goes to next cell
			const item = createItem(0, 10, 10);
			hash.insert(item);

			// floor(10/10) = 1, so should be in cell (1, 1)
			// But let's verify it's queryable from that position
			const results = hash.queryNearby(10, 10);
			expect(results.flat()).toContain(item);
		});

		it('should handle items at world edges', () => {
			const item = createItem(0, 99, 99);
			hash.insert(item);

			const results = hash.queryNearby(99, 99);
			expect(results.flat()).toContain(item);
		});

		it('should wrap coordinates for edge queries', () => {
			// Insert item near edge
			const item = createItem(0, 95, 95);
			hash.insert(item);

			// Query should still work
			const results = hash.queryNearby(95, 95);
			expect(results.flat()).toContain(item);
		});
	});

	describe('performance characteristics', () => {
		it('should handle many items efficiently', () => {
			const items: TestItem[] = [];
			for (let i = 0; i < 1000; i++) {
				items.push(createItem(i, Math.random() * 100, Math.random() * 100));
			}

			hash.insertAll(items);

			// Query should be fast (not timing, just ensuring it works)
			const results = hash.queryNearby(50, 50);
			expect(results).toBeDefined();
		});

		it('should clear efficiently', () => {
			const items: TestItem[] = [];
			for (let i = 0; i < 1000; i++) {
				items.push(createItem(i, Math.random() * 100, Math.random() * 100));
			}

			hash.insertAll(items);
			hash.clear();

			expect(hash.activeCellCount).toBe(0);
		});
	});
});

