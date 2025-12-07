/**
 * GGDPManager - Central coordinator for all GGDP dimensional optimizations.
 *
 * This manager:
 * - Maintains the enabled/disabled state of each dimension
 * - Provides toggle/enable/disable methods
 * - Collects and aggregates performance metrics
 * - Emits events when dimensions are toggled
 */

import { eventBus } from '../core/EventBus.js';
import { performanceMetrics, PerformanceMetrics } from './metrics/PerformanceMetrics.js';
import type { GGDPSettings } from '../core/types.js';
import {
	type DimensionName,
	type GGDPConfig,
	type MutableGGDPConfig,
	type AggregateMetrics,
	type DimensionMetrics,
	DEFAULT_GGDP_CONFIG,
} from './types.js';

/**
 * Display information for each dimension.
 */
interface DimensionInfo {
	readonly displayName: string;
	readonly description: string;
}

/**
 * Display info for all dimensions.
 */
const DIMENSION_INFO: Record<DimensionName, DimensionInfo> = {
	spatial: {
		displayName: 'Spatial Hash',
		description: 'O(1) neighbor queries via grid partitioning',
	},
	morton: {
		displayName: 'Morton Order',
		description: 'Cache-coherent iteration via Z-order curves',
	},
	temporal: {
		displayName: 'Time Wheel',
		description: 'Staggered updates (1/N boids per frame)',
	},
	'hierarchical-temporal': {
		displayName: 'Hierarchical Time',
		description: 'Multi-level time wheel with activity-based promotion',
	},
	perceptual: {
		displayName: 'Geodesic Perception',
		description: 'Blind spots and directional awareness',
	},
	influence: {
		displayName: 'Hyperbolic Influence',
		description: 'Sigmoid distance falloff for social LOD',
	},
	flow: {
		displayName: 'Flow Field',
		description: 'O(1) environmental force lookup',
	},
	visual: {
		displayName: 'Visual Fiber',
		description: 'Stress-based render batching',
	},
};

/**
 * Manages GGDP dimensional optimizations.
 */
class GGDPManager {
	/** Current configuration state */
	private readonly state: MutableGGDPConfig;

	/** Performance metrics tracker */
	public readonly metrics: PerformanceMetrics;

	/** Boid count for metrics */
	private _boidCount = 0;

	/**
	 * Creates a new GGDPManager.
	 */
	public constructor() {
		this.state = { ...DEFAULT_GGDP_CONFIG };
		this.metrics = performanceMetrics;
		this.loadFromLocalStorage();
	}

	// =========================================================================
	// Configuration Access
	// =========================================================================

	/**
	 * Gets the current GGDP configuration (read-only).
	 */
	public get config(): Readonly<GGDPConfig> {
		return this.state;
	}

	/**
	 * Gets a specific configuration value.
	 */
	public get<K extends keyof GGDPConfig>(key: K): GGDPConfig[K] {
		return this.state[key];
	}

	/**
	 * Sets a configuration value.
	 */
	public set<K extends keyof GGDPConfig>(key: K, value: GGDPConfig[K]): void {
		if (this.state[key] === value) return;

		this.state[key] = value;
		this.saveToLocalStorage();

		// Emit config change event
		eventBus.emit('config:change', { key: `ggdp.${key}` as never, value });
	}

	// =========================================================================
	// Dimension Toggle Methods
	// =========================================================================

	/**
	 * Syncs the internal state from an external config.
	 * Call this each frame to ensure dashboard reflects UI state.
	 */
	public syncFromConfig(config: GGDPSettings): void {
		this.state.spatialHash = config.spatialHash;
		this.state.mortonOrder = config.mortonOrder;
		this.state.timeWheel = config.timeWheel;
		this.state.hierarchicalTimeWheel = config.hierarchicalTimeWheel;
		this.state.geodesicPerception = config.geodesicPerception;
		this.state.hyperbolicInfluence = config.hyperbolicInfluence;
		this.state.flowField = config.flowField;
		this.state.visualFiber = config.visualFiber;
	}

	/**
	 * Checks if a dimension is enabled.
	 */
	public isEnabled(dimension: DimensionName): boolean {
		switch (dimension) {
			case 'spatial':
				return this.state.spatialHash;
			case 'morton':
				return this.state.mortonOrder;
			case 'temporal':
				return this.state.timeWheel;
			case 'hierarchical-temporal':
				return this.state.hierarchicalTimeWheel;
			case 'perceptual':
				return this.state.geodesicPerception;
			case 'influence':
				return this.state.hyperbolicInfluence;
			case 'flow':
				return this.state.flowField;
			case 'visual':
				return this.state.visualFiber;
		}
	}

	/**
	 * Enables a dimension.
	 */
	public enable(dimension: DimensionName): void {
		this.setDimensionEnabled(dimension, true);
	}

	/**
	 * Disables a dimension.
	 */
	public disable(dimension: DimensionName): void {
		this.setDimensionEnabled(dimension, false);
	}

	/**
	 * Toggles a dimension.
	 */
	public toggle(dimension: DimensionName): void {
		this.setDimensionEnabled(dimension, !this.isEnabled(dimension));
	}

	/**
	 * Sets the enabled state of a dimension.
	 */
	private setDimensionEnabled(dimension: DimensionName, enabled: boolean): void {
		const currentlyEnabled = this.isEnabled(dimension);
		if (currentlyEnabled === enabled) return;

		switch (dimension) {
			case 'spatial':
				this.state.spatialHash = enabled;
				break;
			case 'morton':
				this.state.mortonOrder = enabled;
				break;
			case 'temporal':
				this.state.timeWheel = enabled;
				break;
			case 'hierarchical-temporal':
				this.state.hierarchicalTimeWheel = enabled;
				break;
			case 'perceptual':
				this.state.geodesicPerception = enabled;
				break;
			case 'influence':
				this.state.hyperbolicInfluence = enabled;
				break;
			case 'flow':
				this.state.flowField = enabled;
				break;
			case 'visual':
				this.state.visualFiber = enabled;
				break;
		}

		this.saveToLocalStorage();

		// Emit toggle event for UI updates
		// Note: Using config:change since we haven't added ggdp events to EventBus yet
		eventBus.emit('config:change', {
			key: `ggdp.${dimension}` as never,
			value: enabled,
		});
	}

	// =========================================================================
	// Dimension Info
	// =========================================================================

	/**
	 * Gets display information for a dimension.
	 */
	public getDimensionInfo(dimension: DimensionName): DimensionInfo {
		return DIMENSION_INFO[dimension];
	}

	/**
	 * Gets all dimension names.
	 */
	public getAllDimensions(): readonly DimensionName[] {
		return ['spatial', 'morton', 'temporal', 'hierarchical-temporal', 'perceptual', 'influence', 'flow', 'visual'];
	}

	// =========================================================================
	// Metrics
	// =========================================================================

	/**
	 * Sets the current boid count for metrics.
	 */
	public setBoidCount(count: number): void {
		this._boidCount = count;
	}

	/**
	 * Gets aggregate metrics for all dimensions.
	 */
	public getAggregateMetrics(): AggregateMetrics {
		const dimensions: DimensionMetrics[] = this.getAllDimensions().map((dim) =>
			this.metrics.getDimensionMetrics(dim, this.isEnabled(dim))
		);

		return {
			fps: this.metrics.fps,
			boidCount: this._boidCount,
			neighborChecks: this.metrics.neighborChecks,
			physicsTimeMs: this.metrics.getAverage('physics'),
			renderTimeMs: this.metrics.getAverage('render'),
			dimensions,
		};
	}

	// =========================================================================
	// Persistence
	// =========================================================================

	/**
	 * Loads GGDP configuration from local storage.
	 */
	private loadFromLocalStorage(): void {
		try {
			const saved = localStorage.getItem('ggdp-config');
			if (saved !== null) {
				const parsed = JSON.parse(saved) as Partial<GGDPConfig>;
				Object.assign(this.state, parsed);
			}
		} catch {
			// Ignore errors, use defaults
		}
	}

	/**
	 * Saves GGDP configuration to local storage.
	 */
	private saveToLocalStorage(): void {
		try {
			localStorage.setItem('ggdp-config', JSON.stringify(this.state));
		} catch {
			// Ignore storage errors
		}
	}

	/**
	 * Resets all GGDP settings to defaults.
	 */
	public reset(): void {
		Object.assign(this.state, DEFAULT_GGDP_CONFIG);
		this.saveToLocalStorage();
		this.metrics.reset();
	}
}

/**
 * Singleton instance of GGDPManager.
 */
export const ggdpManager = new GGDPManager();

