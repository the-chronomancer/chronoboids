/**
 * PerformanceMetrics - Real-time performance tracking for GGDP dimensions.
 *
 * Provides high-precision timing measurements using performance.now()
 * and calculates rolling averages for smooth display.
 */

import type { DimensionName, DimensionMetrics } from '../types.js';

/**
 * Number of samples to keep for rolling average calculation.
 */
const ROLLING_WINDOW_SIZE = 60;

/**
 * Internal tracking data for a single metric.
 */
interface MetricData {
	/** Recent timing samples */
	samples: number[];
	/** Current sample index (circular buffer) */
	sampleIndex: number;
	/** Running sum for fast average calculation */
	runningSum: number;
	/** Call count this frame */
	frameCallCount: number;
	/** Active measurement start time */
	activeStart: number | null;
	/** Custom impact string */
	impact: string;
	/** Raw comparison value */
	rawValue: number;
}

/**
 * Tracks performance metrics with rolling averages.
 */
export class PerformanceMetrics {
	/** Metrics data keyed by name */
	private readonly metrics = new Map<string, MetricData>();

	/** Frame timing */
	private frameStart = 0;

	/** Aggregate counters */
	private _neighborChecks = 0;
	private _physicsTime = 0;
	private _renderTime = 0;

	/**
	 * Creates a new PerformanceMetrics instance.
	 */
	public constructor() {
		// Pre-initialize metrics for all dimensions
		const dimensions: DimensionName[] = [
			'spatial',
			'morton',
			'temporal',
			'perceptual',
			'influence',
			'flow',
			'visual',
		];

		for (const dim of dimensions) {
			this.initMetric(dim);
		}

		// Also track aggregate categories
		this.initMetric('physics');
		this.initMetric('render');
		this.initMetric('frame');
	}

	/**
	 * Initializes tracking data for a metric.
	 */
	private initMetric(name: string): void {
		this.metrics.set(name, {
			samples: new Array<number>(ROLLING_WINDOW_SIZE).fill(0),
			sampleIndex: 0,
			runningSum: 0,
			frameCallCount: 0,
			activeStart: null,
			impact: '--',
			rawValue: 0,
		});
	}

	// =========================================================================
	// Timing Methods
	// =========================================================================

	/**
	 * Starts timing a measurement.
	 * @param name - Metric name
	 */
	public startMeasure(name: string): void {
		let data = this.metrics.get(name);
		if (data === undefined) {
			this.initMetric(name);
			data = this.metrics.get(name)!;
		}
		data.activeStart = performance.now();
	}

	/**
	 * Ends timing a measurement and records the duration.
	 * @param name - Metric name
	 * @returns The measurement duration in milliseconds
	 */
	public endMeasure(name: string): number {
		const data = this.metrics.get(name);
		const activeStart = data?.activeStart;
		if (data === undefined || activeStart === undefined || activeStart === null) {
			return 0;
		}

		const duration = performance.now() - activeStart;
		data.activeStart = null;
		data.frameCallCount++;

		// Add to rolling average
		this.addSample(name, duration);

		return duration;
	}

	/**
	 * Adds a sample to the rolling average.
	 */
	private addSample(name: string, value: number): void {
		const data = this.metrics.get(name);
		if (data === undefined) return;

		// Subtract old value from running sum
		const oldValue = data.samples[data.sampleIndex] ?? 0;
		data.runningSum -= oldValue;

		// Add new value
		data.samples[data.sampleIndex] = value;
		data.runningSum += value;

		// Advance circular buffer index
		data.sampleIndex = (data.sampleIndex + 1) % ROLLING_WINDOW_SIZE;
	}

	/**
	 * Gets the rolling average for a metric.
	 */
	public getAverage(name: string): number {
		const data = this.metrics.get(name);
		if (data === undefined) return 0;
		return data.runningSum / ROLLING_WINDOW_SIZE;
	}

	/**
	 * Records a timing measurement directly (without start/end).
	 */
	public recordMeasurement(name: string, durationMs: number): void {
		this.addSample(name, durationMs);
		const data = this.metrics.get(name);
		if (data !== undefined) {
			data.frameCallCount++;
		}
	}

	// =========================================================================
	// Frame Lifecycle
	// =========================================================================

	/**
	 * Called at the start of each frame.
	 */
	public beginFrame(): void {
		this.frameStart = performance.now();

		// Reset per-frame counters
		this._neighborChecks = 0;
		this._physicsTime = 0;
		this._renderTime = 0;

		// Reset call counts
		for (const data of this.metrics.values()) {
			data.frameCallCount = 0;
		}
	}

	/**
	 * Called at the end of each frame.
	 */
	public endFrame(): void {
		const frameTime = performance.now() - this.frameStart;
		this.addSample('frame', frameTime);
	}

	/**
	 * Gets the current FPS based on frame time.
	 */
	public get fps(): number {
		const avgFrameTime = this.getAverage('frame');
		return avgFrameTime > 0 ? 1000 / avgFrameTime : 60;
	}

	// =========================================================================
	// Aggregate Counters
	// =========================================================================

	/**
	 * Increments the neighbor check counter.
	 */
	public addNeighborChecks(count: number): void {
		this._neighborChecks += count;
	}

	/**
	 * Gets the neighbor check count for this frame.
	 */
	public get neighborChecks(): number {
		return this._neighborChecks;
	}

	/**
	 * Records physics time for this frame.
	 */
	public recordPhysicsTime(ms: number): void {
		this._physicsTime = ms;
		this.addSample('physics', ms);
	}

	/**
	 * Gets the physics time for this frame.
	 */
	public get physicsTime(): number {
		return this._physicsTime;
	}

	/**
	 * Records render time for this frame.
	 */
	public recordRenderTime(ms: number): void {
		this._renderTime = ms;
		this.addSample('render', ms);
	}

	/**
	 * Gets the render time for this frame.
	 */
	public get renderTime(): number {
		return this._renderTime;
	}

	// =========================================================================
	// Impact Tracking
	// =========================================================================

	/**
	 * Sets the impact string for a dimension.
	 */
	public setImpact(name: string, impact: string, rawValue: number = 0): void {
		const data = this.metrics.get(name);
		if (data !== undefined) {
			data.impact = impact;
			data.rawValue = rawValue;
		}
	}

	/**
	 * Gets metrics for a specific dimension.
	 */
	public getDimensionMetrics(name: DimensionName, enabled: boolean): DimensionMetrics {
		const data = this.metrics.get(name);
		return {
			name,
			enabled,
			avgTimeMs: data !== undefined ? data.runningSum / ROLLING_WINDOW_SIZE : 0,
			callCount: data?.frameCallCount ?? 0,
			impact: data?.impact ?? '--',
			rawValue: data?.rawValue ?? 0,
		};
	}

	// =========================================================================
	// Reset
	// =========================================================================

	/**
	 * Resets all metrics to initial state.
	 */
	public reset(): void {
		for (const data of this.metrics.values()) {
			data.samples.fill(0);
			data.sampleIndex = 0;
			data.runningSum = 0;
			data.frameCallCount = 0;
			data.activeStart = null;
			data.impact = '--';
			data.rawValue = 0;
		}
		this._neighborChecks = 0;
		this._physicsTime = 0;
		this._renderTime = 0;
	}
}

/**
 * Singleton instance of PerformanceMetrics.
 */
export const performanceMetrics = new PerformanceMetrics();

