/**
 * SpatialHash - O(1) spatial partitioning for neighbor queries.
 *
 * This implements the GGDP (Geometry-Guided Dynamic Programming) pattern:
 * - Instead of O(n²) pairwise distance checks, we use O(n) spatial hashing
 * - Entities are bucketed by position into a grid
 * - Neighbor queries only check adjacent cells (9 cells in 2D)
 *
 * Performance characteristics:
 * - Insert: O(1) amortized
 * - Query: O(k) where k is entities in nearby cells
 * - Clear: O(k) where k is active cells (not total cells)
 */

import type { IReadonlyVector2D } from '../core/types.js';

/**
 * Interface for objects that can be spatially hashed.
 */
export interface Spatial extends IReadonlyVector2D {
	readonly index: number;
}

/**
 * A cell in the spatial hash grid.
 */
interface Cell<T> {
	items: T[];
}

/**
 * Spatial hash grid for efficient neighbor queries.
 * @template T - Type of items stored (must have x, y, index properties)
 */
export class SpatialHash<T extends Spatial> {
	/** Cell size (should match vision radius) */
	private cellSize: number;

	/** World dimensions */
	private width: number;
	private height: number;

	/** Grid dimensions in cells */
	private cols: number;
	private rows: number;

	/** The grid of cells (sparse - only populated cells exist) */
	private readonly grid: Map<number, Cell<T>>;

	/** Track active cells for O(k) clearing */
	private readonly activeCells: Set<number>;

	/** Reusable array for query results */
	private readonly queryResult: T[][] = [];

	/**
	 * Creates a new spatial hash.
	 * @param cellSize - Size of each cell (should match vision radius)
	 * @param width - World width
	 * @param height - World height
	 */
	public constructor(cellSize: number, width: number, height: number) {
		this.cellSize = cellSize;
		this.width = width;
		this.height = height;
		this.cols = Math.ceil(width / cellSize);
		this.rows = Math.ceil(height / cellSize);
		this.grid = new Map();
		this.activeCells = new Set();
	}

	/**
	 * Gets the current cell size.
	 */
	public getCellSize(): number {
		return this.cellSize;
	}

	/**
	 * Updates the grid dimensions if world size or cell size changed.
	 * @returns true if dimensions changed
	 */
	public resize(cellSize: number, width: number, height: number): boolean {
		if (this.cellSize === cellSize && this.width === width && this.height === height) {
			return false;
		}

		this.cellSize = cellSize;
		this.width = width;
		this.height = height;
		this.cols = Math.ceil(width / cellSize);
		this.rows = Math.ceil(height / cellSize);

		// Clear the grid on resize
		this.clear();
		return true;
	}

	/**
	 * Clears all items from the grid.
	 * O(k) where k is the number of active cells.
	 */
	public clear(): void {
		// Only clear cells that were actually used
		for (const key of this.activeCells) {
			const cell = this.grid.get(key);
			if (cell !== undefined) {
				cell.items.length = 0;
			}
		}
		this.activeCells.clear();
	}

	/**
	 * Inserts an item into the grid.
	 * O(1) amortized.
	 */
	public insert(item: T): void {
		const key = this.getKey(item.x, item.y);
		let cell = this.grid.get(key);

		if (cell === undefined) {
			cell = { items: [] };
			this.grid.set(key, cell);
		}

		cell.items.push(item);
		this.activeCells.add(key);
	}

	/**
	 * Inserts multiple items into the grid.
	 * O(n) where n is the number of items.
	 */
	public insertAll(items: readonly T[]): void {
		for (const item of items) {
			this.insert(item);
		}
	}

	/**
	 * Gets all items in cells adjacent to the given position.
	 * Returns an array of arrays (one per cell) to avoid allocations.
	 *
	 * @param x - X position
	 * @param y - Y position
	 * @returns Array of item arrays from nearby cells
	 */
	public queryNearby(x: number, y: number): readonly T[][] {
		// Clear and reuse the result array
		this.queryResult.length = 0;

		const col = Math.floor(x / this.cellSize);
		const row = Math.floor(y / this.cellSize);

		// Check 3x3 neighborhood
		for (let dr = -1; dr <= 1; dr++) {
			for (let dc = -1; dc <= 1; dc++) {
				const key = this.getKeyFromCell(row + dr, col + dc);
				const cell = this.grid.get(key);
				if (cell !== undefined && cell.items.length > 0) {
					this.queryResult.push(cell.items);
				}
			}
		}

		return this.queryResult;
	}

	/**
	 * Counts total items in cells adjacent to the given position.
	 * O(1) - checks at most 9 cells.
	 */
	public countNearby(x: number, y: number): number {
		let count = 0;
		const col = Math.floor(x / this.cellSize);
		const row = Math.floor(y / this.cellSize);

		for (let dr = -1; dr <= 1; dr++) {
			for (let dc = -1; dc <= 1; dc++) {
				const key = this.getKeyFromCell(row + dr, col + dc);
				const cell = this.grid.get(key);
				if (cell !== undefined) {
					count += cell.items.length;
				}
			}
		}

		return count;
	}

	/**
	 * Gets all items in a specific cell.
	 */
	public getCell(row: number, col: number): readonly T[] {
		const key = this.getKeyFromCell(row, col);
		const cell = this.grid.get(key);
		return cell?.items ?? [];
	}

	/**
	 * Computes a unique key for a cell from world coordinates.
	 */
	private getKey(x: number, y: number): number {
		const col = Math.floor(x / this.cellSize);
		const row = Math.floor(y / this.cellSize);
		return this.getKeyFromCell(row, col);
	}

	/**
	 * Computes a unique key for a cell from cell coordinates.
	 * Uses a simple formula that handles negative coordinates.
	 */
	private getKeyFromCell(row: number, col: number): number {
		// Wrap negative coordinates
		const wrappedCol = ((col % this.cols) + this.cols) % this.cols;
		const wrappedRow = ((row % this.rows) + this.rows) % this.rows;
		return wrappedRow * this.cols + wrappedCol;
	}

	// ==========================================================================
	// Getters for grid info
	// ==========================================================================

	public get gridCols(): number {
		return this.cols;
	}

	public get gridRows(): number {
		return this.rows;
	}

	public get gridCellSize(): number {
		return this.cellSize;
	}

	public get gridWidth(): number {
		return this.cols * this.cellSize;
	}

	public get gridHeight(): number {
		return this.rows * this.cellSize;
	}

	public get activeCellCount(): number {
		return this.activeCells.size;
	}
}

