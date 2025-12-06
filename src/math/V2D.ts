/**
 * V2D - A high-performance 2D vector class.
 *
 * Design decisions:
 * - Mutable operations for performance (no allocations in hot paths)
 * - Static methods for immutable operations when needed
 * - Chainable methods for fluent API
 * - Squared magnitude/distance methods to avoid sqrt when possible
 */

import type { IVector2D, IReadonlyVector2D } from '../core/types.js';

/**
 * 2D Vector class with comprehensive vector math operations.
 * All instance methods mutate and return `this` for chaining.
 */
export class V2D implements IVector2D {
	public x: number;
	public y: number;

	// ==========================================================================
	// Static Factory Methods
	// ==========================================================================

	/**
	 * Creates a V2D from an array [x, y].
	 */
	public static fromArray(array: readonly [number, number]): V2D {
		return new V2D(array[0], array[1]);
	}

	/**
	 * Creates a V2D from an object with x and y properties.
	 */
	public static fromObject(obj: IReadonlyVector2D): V2D {
		return new V2D(obj.x, obj.y);
	}

	/**
	 * Creates a random unit vector scaled by the given magnitude.
	 */
	public static random(scale = 1): V2D {
		const angle = Math.random() * Math.PI * 2;
		return new V2D(Math.cos(angle) * scale, Math.sin(angle) * scale);
	}

	// ==========================================================================
	// Static Immutable Operations
	// ==========================================================================

	/**
	 * Adds two vectors and returns a new vector.
	 */
	public static add(a: IReadonlyVector2D, b: IReadonlyVector2D): V2D {
		return new V2D(a.x + b.x, a.y + b.y);
	}

	/**
	 * Subtracts b from a and returns a new vector.
	 */
	public static sub(a: IReadonlyVector2D, b: IReadonlyVector2D): V2D {
		return new V2D(a.x - b.x, a.y - b.y);
	}

	/**
	 * Multiplies a vector by a scalar and returns a new vector.
	 */
	public static mult(v: IReadonlyVector2D, scale: number): V2D {
		return new V2D(v.x * scale, v.y * scale);
	}

	/**
	 * Divides a vector by a scalar and returns a new vector.
	 */
	public static div(v: IReadonlyVector2D, scale: number): V2D {
		return new V2D(v.x / scale, v.y / scale);
	}

	/**
	 * Returns the dot product of two vectors.
	 */
	public static dot(a: IReadonlyVector2D, b: IReadonlyVector2D): number {
		return a.x * b.x + a.y * b.y;
	}

	/**
	 * Returns the squared distance between two vectors.
	 * Use this instead of dist() when comparing distances to avoid sqrt.
	 */
	public static sqrDist(a: IReadonlyVector2D, b: IReadonlyVector2D): number {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return dx * dx + dy * dy;
	}

	/**
	 * Returns the distance between two vectors.
	 */
	public static dist(a: IReadonlyVector2D, b: IReadonlyVector2D): number {
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	/**
	 * Linearly interpolates between two vectors.
	 */
	public static lerp(a: IReadonlyVector2D, b: IReadonlyVector2D, t: number): V2D {
		return new V2D(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
	}

	// ==========================================================================
	// Constructor
	// ==========================================================================

	/**
	 * Creates a new 2D vector.
	 * @param x - X component (default 0)
	 * @param y - Y component (default 0)
	 */
	public constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	// ==========================================================================
	// Conversion Methods
	// ==========================================================================

	/**
	 * Returns a string representation "x,y".
	 */
	public toString(radix = 10): string {
		return `${this.x.toString(radix)},${this.y.toString(radix)}`;
	}

	/**
	 * Returns an array [x, y].
	 */
	public toArray(): [number, number] {
		return [this.x, this.y];
	}

	/**
	 * Returns a plain object {x, y}.
	 */
	public toObject(): IVector2D {
		return { x: this.x, y: this.y };
	}

	// ==========================================================================
	// Setter Methods
	// ==========================================================================

	/**
	 * Sets both components.
	 */
	public set(x: number, y: number): this {
		this.x = x;
		this.y = y;
		return this;
	}

	/**
	 * Copies values from another vector.
	 */
	public copy(v: IReadonlyVector2D): this {
		this.x = v.x;
		this.y = v.y;
		return this;
	}

	/**
	 * Returns a new identical vector.
	 */
	public clone(): V2D {
		return new V2D(this.x, this.y);
	}

	// ==========================================================================
	// Scalar Properties (Read-only)
	// ==========================================================================

	/**
	 * Returns the angle in radians.
	 */
	public angle(): number {
		return Math.atan2(this.y, this.x);
	}

	/**
	 * Returns the squared magnitude.
	 * Use this instead of mag() when comparing magnitudes to avoid sqrt.
	 */
	public sqrMag(): number {
		return this.x * this.x + this.y * this.y;
	}

	/**
	 * Returns the magnitude (length).
	 */
	public mag(): number {
		return Math.hypot(this.x, this.y);
	}

	/**
	 * Returns the squared distance to another vector.
	 */
	public sqrDist(v: IReadonlyVector2D): number {
		const dx = this.x - v.x;
		const dy = this.y - v.y;
		return dx * dx + dy * dy;
	}

	/**
	 * Returns the distance to another vector.
	 */
	public dist(v: IReadonlyVector2D): number {
		return Math.hypot(this.x - v.x, this.y - v.y);
	}

	/**
	 * Returns the dot product with another vector.
	 */
	public dot(v: IReadonlyVector2D): number {
		return this.x * v.x + this.y * v.y;
	}

	// ==========================================================================
	// Unary Operations (Mutating)
	// ==========================================================================

	/**
	 * Sets both components to zero.
	 */
	public zero(): this {
		this.x = 0;
		this.y = 0;
		return this;
	}

	/**
	 * Normalizes to unit length (magnitude 1).
	 */
	public normalize(): this {
		const sqrLen = this.sqrMag();
		if (sqrLen > 0) {
			const invLen = 1 / Math.sqrt(sqrLen);
			this.x *= invLen;
			this.y *= invLen;
		}
		return this;
	}

	/**
	 * Negates both components.
	 */
	public negate(): this {
		this.x = -this.x;
		this.y = -this.y;
		return this;
	}

	// ==========================================================================
	// Scalar Operations (Mutating)
	// ==========================================================================

	/**
	 * Sets to a random direction with given magnitude.
	 */
	public random(scale: number): this {
		const angle = Math.random() * Math.PI * 2;
		this.x = Math.cos(angle) * scale;
		this.y = Math.sin(angle) * scale;
		return this;
	}

	/**
	 * Rotates by the given angle in radians.
	 */
	public rotate(angle: number): this {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const newX = this.x * cos - this.y * sin;
		this.y = this.x * sin + this.y * cos;
		this.x = newX;
		return this;
	}

	/**
	 * Multiplies by a scalar.
	 */
	public mult(scale: number): this {
		this.x *= scale;
		this.y *= scale;
		return this;
	}

	/**
	 * Divides by a scalar.
	 */
	public div(scale: number): this {
		this.x /= scale;
		this.y /= scale;
		return this;
	}

	/**
	 * Sets the magnitude to the given value.
	 */
	public setMag(scale: number): this {
		const sqrLen = this.sqrMag();
		if (sqrLen > 0) {
			const factor = scale / Math.sqrt(sqrLen);
			this.x *= factor;
			this.y *= factor;
		}
		return this;
	}

	/**
	 * Limits the magnitude to at most the given value.
	 */
	public max(scale: number): this {
		const sqrLen = this.sqrMag();
		const sqrMax = scale * scale;
		if (sqrLen > sqrMax) {
			this.setMag(scale);
		}
		return this;
	}

	/**
	 * Ensures the magnitude is at least the given value.
	 */
	public min(scale: number): this {
		const sqrLen = this.sqrMag();
		const sqrMin = scale * scale;
		if (sqrLen < sqrMin) {
			this.setMag(scale);
		}
		return this;
	}

	// ==========================================================================
	// Vector Operations (Mutating)
	// ==========================================================================

	/**
	 * Adds another vector.
	 */
	public add(v: IReadonlyVector2D): this {
		this.x += v.x;
		this.y += v.y;
		return this;
	}

	/**
	 * Subtracts another vector.
	 */
	public sub(v: IReadonlyVector2D): this {
		this.x -= v.x;
		this.y -= v.y;
		return this;
	}

	/**
	 * Adds another vector scaled by a factor.
	 * Equivalent to: this += v * scale
	 */
	public sclAdd(v: IReadonlyVector2D, scale: number): this {
		this.x += v.x * scale;
		this.y += v.y * scale;
		return this;
	}

	/**
	 * Linearly interpolates toward another vector.
	 */
	public lerp(v: IReadonlyVector2D, t: number): this {
		this.x += (v.x - this.x) * t;
		this.y += (v.y - this.y) * t;
		return this;
	}
}

