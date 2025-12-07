/**
 * TemporalDimension - Time wheel for staggered updates.
 *
 * Instead of updating all boids every frame, the time wheel distributes
 * boids across N slots. Each frame, only boids in the current slot get
 * full physics updates; others interpolate their positions.
 *
 * When enabled: Only 1/N boids update per frame (10-16x capacity)
 * When disabled: All boids update every frame
 */

import type { BoidEntity } from '../../entities/BoidEntity.js';
import { performanceMetrics } from '../metrics/PerformanceMetrics.js';

/**
 * A circular buffer of slots for temporal distribution.
 */
export class TimeWheel<T extends { index: number }> {
	/** Array of slots, each containing items scheduled for that slot */
	private readonly slots: T[][];

	/** Current slot index */
	private currentSlot = 0;

	/** Number of slots */
	private readonly slotCount: number;

	/**
	 * Creates a new TimeWheel.
	 * @param slots - Number of slots (default 16 = 1/16 updates per frame)
	 */
	public constructor(slots = 16) {
		this.slotCount = slots;
		this.slots = [];
		for (let i = 0; i < slots; i++) {
			this.slots.push([]);
		}
	}

	/**
	 * Clears all slots.
	 */
	public clear(): void {
		for (const slot of this.slots) {
			slot.length = 0;
		}
		this.currentSlot = 0;
	}

	/**
	 * Inserts an item into its designated slot based on its index.
	 * Items are evenly distributed across slots.
	 */
	public insert(item: T): void {
		const slotIndex = item.index % this.slotCount;
		this.slots[slotIndex]!.push(item);
	}

	/**
	 * Inserts multiple items.
	 */
	public insertAll(items: readonly T[]): void {
		for (const item of items) {
			this.insert(item);
		}
	}

	/**
	 * Advances to the next slot and returns items that should update this frame.
	 */
	public tick(): readonly T[] {
		const active = this.slots[this.currentSlot]!;
		this.currentSlot = (this.currentSlot + 1) % this.slotCount;
		return active;
	}

	/**
	 * Gets items in the current slot without advancing.
	 */
	public getCurrentSlotItems(): readonly T[] {
		return this.slots[this.currentSlot]!;
	}

	/**
	 * Promotes an item to the current slot (for priority updates).
	 * Useful when a boid needs immediate update (e.g., near mouse).
	 */
	public promote(item: T): void {
		const originalSlot = item.index % this.slotCount;

		// Remove from original slot
		const slot = this.slots[originalSlot]!;
		const idx = slot.indexOf(item);
		if (idx >= 0) {
			slot.splice(idx, 1);
		}

		// Add to current slot
		this.slots[this.currentSlot]!.push(item);
	}

	/**
	 * Checks if an item is scheduled for the current slot.
	 */
	public isActiveThisFrame(item: T): boolean {
		return item.index % this.slotCount === this.currentSlot;
	}

	/**
	 * Gets the current slot index.
	 */
	public get current(): number {
		return this.currentSlot;
	}

	/**
	 * Gets the number of slots.
	 */
	public get size(): number {
		return this.slotCount;
	}

	/**
	 * Gets items in a specific slot.
	 */
	public getSlot(index: number): readonly T[] {
		return this.slots[index % this.slotCount]!;
	}
}

/**
 * Provides temporal distribution with toggle support.
 */
export class TemporalDimension {
	/** The time wheel for boid distribution */
	private readonly timeWheel: TimeWheel<BoidEntity>;

	/** Whether temporal distribution is enabled */
	private _enabled = false;

	/** Number of slots (configurable) */
	private _slotCount: number;

	/** Track how many boids were fully updated vs interpolated */
	private _fullUpdates = 0;
	private _interpolations = 0;

	/**
	 * Creates a new TemporalDimension.
	 */
	public constructor(slots = 16) {
		this._slotCount = slots;
		this.timeWheel = new TimeWheel(slots);
	}

	/**
	 * Whether temporal distribution is enabled.
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(value: boolean) {
		this._enabled = value;
	}

	/**
	 * Gets the number of slots.
	 */
	public get slotCount(): number {
		return this._slotCount;
	}

	/**
	 * Sets the number of slots (requires rebuild).
	 */
	public setSlotCount(slots: number): void {
		if (slots !== this._slotCount && slots > 0) {
			this._slotCount = slots;
			// Note: TimeWheel doesn't support resize, so we'd need to recreate
			// For now, this is set at construction
		}
	}

	/**
	 * Rebuilds the time wheel with all boids.
	 */
	public rebuild(boids: readonly BoidEntity[]): void {
		if (!this._enabled) return;

		performanceMetrics.startMeasure('temporal');
		this.timeWheel.clear();
		this.timeWheel.insertAll(boids);
		performanceMetrics.endMeasure('temporal');
	}

	/**
	 * Gets boids that should receive full physics updates this frame.
	 *
	 * When enabled: Returns only boids in current time slot
	 * When disabled: Returns all boids
	 */
	public getActiveBoidsThisFrame(allBoids: readonly BoidEntity[]): readonly BoidEntity[] {
		if (!this._enabled) {
			this._fullUpdates = allBoids.length;
			this._interpolations = 0;
			return allBoids;
		}

		const active = this.timeWheel.tick();
		this._fullUpdates = active.length;
		this._interpolations = allBoids.length - active.length;
		return active;
	}

	/**
	 * Checks if a specific boid should receive full update this frame.
	 */
	public shouldFullUpdate(boid: BoidEntity): boolean {
		if (!this._enabled) return true;
		return this.timeWheel.isActiveThisFrame(boid);
	}

	/**
	 * Promotes a boid for immediate update (e.g., near interaction).
	 */
	public promoteForUpdate(boid: BoidEntity): void {
		if (this._enabled) {
			this.timeWheel.promote(boid);
		}
	}

	/**
	 * Interpolates position for boids not receiving full update.
	 * Simple linear extrapolation based on velocity.
	 */
	public interpolate(boid: BoidEntity, delta: number): void {
		if (!this._enabled) return;

		// Linear extrapolation: position += velocity * delta
		boid.x += boid.velocity.x * delta;
		boid.y += boid.velocity.y * delta;
	}

	/**
	 * Updates the impact metric.
	 */
	public updateMetrics(_totalBoids: number): void {
		if (this._enabled) {
			const capacityMultiplier = this._slotCount;
			performanceMetrics.setImpact(
				'temporal',
				`${capacityMultiplier}x capacity`,
				this._fullUpdates
			);
		} else {
			performanceMetrics.setImpact('temporal', '--', 0);
		}
	}

	/**
	 * Gets statistics for this frame.
	 */
	public getStats(): { fullUpdates: number; interpolations: number; ratio: number } {
		return {
			fullUpdates: this._fullUpdates,
			interpolations: this._interpolations,
			ratio: this._enabled ? this._slotCount : 1,
		};
	}

	/**
	 * Resets the dimension state.
	 */
	public reset(): void {
		this.timeWheel.clear();
		this._fullUpdates = 0;
		this._interpolations = 0;
	}
}

/**
 * Singleton instance.
 */
export const temporalDimension = new TemporalDimension(16);

