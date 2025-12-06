/**
 * Fast random number generation with O(1) lookup.
 *
 * Pre-computes a large array of random numbers for fast access.
 * This avoids the overhead of Math.random() in hot paths.
 */

const POOL_SIZE = 1_000_000;
const randomPool: number[] = [];
let poolIndex = 0;

// Pre-fill the pool
for (let i = 0; i < POOL_SIZE; i++) {
	randomPool.push(Math.random());
}

/**
 * Gets a random number from the pre-computed pool.
 *
 * @param max - If only one argument, returns [0, max)
 * @param maxOrUndefined - If two arguments, returns [max, maxOrUndefined)
 * @returns Random number in the specified range
 */
export function random(max: number, maxOrUndefined?: number): number {
	// Advance pool index with wrap-around
	poolIndex = (poolIndex + 1) % POOL_SIZE;
	const r = randomPool[poolIndex] ?? Math.random();

	if (maxOrUndefined === undefined) {
		// Single argument: [0, max)
		return r * max;
	} else {
		// Two arguments: [max, maxOrUndefined)
		return r * (maxOrUndefined - max) + max;
	}
}

/**
 * Gets a random integer in the range [min, max].
 */
export function randomInt(min: number, max: number): number {
	return Math.floor(random(min, max + 1));
}

/**
 * Gets a random boolean.
 */
export function randomBool(): boolean {
	return random(1) < 0.5;
}

/**
 * Gets a random element from an array.
 */
export function randomElement<T>(array: readonly T[]): T | undefined {
	if (array.length === 0) return undefined;
	return array[Math.floor(random(array.length))];
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 */
export function shuffle<T>(array: T[]): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(random(i + 1));
		const temp = array[i];
		const swapVal = array[j];
		if (temp !== undefined && swapVal !== undefined) {
			array[i] = swapVal;
			array[j] = temp;
		}
	}
	return array;
}

