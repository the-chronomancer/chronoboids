/**
 * GGDP (Geometry-Guided Dynamic Programming) Type Definitions
 *
 * These interfaces define the contracts for dimensional optimizations
 * that can be toggled on/off to demonstrate performance impacts.
 */

import type { V2D } from '../math/V2D.js';

// =============================================================================
// Dimension Types
// =============================================================================

/**
 * Names of all GGDP dimensions.
 */
export type DimensionName =
	| 'spatial'
	| 'morton'
	| 'temporal'
	| 'hierarchical-temporal'
	| 'perceptual'
	| 'influence'
	| 'flow'
	| 'visual';

/**
 * Base interface for all GGDP dimensions.
 */
export interface GGDPDimension {
	/** Unique name of the dimension */
	readonly name: DimensionName;

	/** Human-readable display name */
	readonly displayName: string;

	/** Brief description of what this dimension optimizes */
	readonly description: string;

	/** Whether this dimension is currently enabled */
	enabled: boolean;

	/** Reset the dimension state */
	reset(): void;
}

// =============================================================================
// Metrics Types
// =============================================================================

/**
 * Performance metrics for a single dimension.
 */
export interface DimensionMetrics {
	/** Dimension name */
	readonly name: DimensionName;

	/** Whether currently enabled */
	readonly enabled: boolean;

	/** Average execution time in milliseconds */
	readonly avgTimeMs: number;

	/** Number of times this dimension was invoked this frame */
	readonly callCount: number;

	/** Estimated performance impact (e.g., "85% fewer checks") */
	readonly impact: string;

	/** Raw metric value for comparison */
	readonly rawValue: number;
}

/**
 * Aggregate metrics for all dimensions.
 */
export interface AggregateMetrics {
	/** Current FPS */
	readonly fps: number;

	/** Total boids in simulation */
	readonly boidCount: number;

	/** Total neighbor checks this frame */
	readonly neighborChecks: number;

	/** Total physics time in ms */
	readonly physicsTimeMs: number;

	/** Total render time in ms */
	readonly renderTimeMs: number;

	/** Per-dimension metrics */
	readonly dimensions: readonly DimensionMetrics[];
}

/**
 * A single timing measurement.
 */
export interface TimingMeasurement {
	/** Start timestamp (performance.now()) */
	start: number;

	/** End timestamp (performance.now()) */
	end: number;

	/** Duration in milliseconds */
	duration: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * GGDP configuration settings.
 */
export interface GGDPConfig {
	// Spatial Dimension (existing spatial hash)
	/** Enable spatial hash for O(1) neighbor queries */
	readonly spatialHash: boolean;

	// Morton Dimension
	/** Enable Morton-ordered bucket iteration for cache coherence */
	readonly mortonOrder: boolean;

	// Temporal Dimension (Time Wheel)
	/** Enable time wheel for staggered updates */
	readonly timeWheel: boolean;
	/** Number of time wheel slots (1/N boids update per frame) */
	readonly timeWheelSlots: number;
	/** Enable hierarchical time wheel (multi-level with activity-based promotion) */
	readonly hierarchicalTimeWheel: boolean;
	/** Velocity threshold below which boids demote to slower update rate */
	readonly activityThreshold: number;

	// Perceptual Dimension (Geodesic)
	/** Enable geodesic perception (blind spots) */
	readonly geodesicPerception: boolean;
	/** Blind spot angle in radians (rear cone) */
	readonly blindSpotAngle: number;
	/** Field of view angle in radians */
	readonly fovAngle: number;

	// Influence Dimension (Hyperbolic)
	/** Enable hyperbolic distance falloff */
	readonly hyperbolicInfluence: boolean;
	/** Steepness of the sigmoid falloff curve */
	readonly influenceSteepness: number;

	// Flow Dimension
	/** Enable flow field forces */
	readonly flowField: boolean;
	/** Flow field force strength multiplier */
	readonly flowStrength: number;
	/** Wind direction in radians */
	readonly windDirection: number;
	/** Wind strength */
	readonly windStrength: number;
	/** Enable turbulence */
	readonly turbulence: boolean;
	/** Turbulence strength */
	readonly turbulenceStrength: number;

	// Visual Dimension
	/** Enable visual fiber (stress-based coloring) */
	readonly visualFiber: boolean;
}

/**
 * Mutable version of GGDPConfig for internal state management.
 */
export type MutableGGDPConfig = {
	-readonly [K in keyof GGDPConfig]: GGDPConfig[K];
};

/**
 * Default GGDP configuration values.
 */
export const DEFAULT_GGDP_CONFIG: Readonly<GGDPConfig> = {
	// Spatial (ON by default - baseline optimization)
	spatialHash: true,

	// Morton (OFF by default)
	mortonOrder: false,

	// Temporal (OFF by default)
	timeWheel: false,
	timeWheelSlots: 16,
	hierarchicalTimeWheel: false,
	activityThreshold: 0.5,

	// Perceptual (OFF by default)
	geodesicPerception: false,
	blindSpotAngle: Math.PI * 0.5, // 90 degree blind spot
	fovAngle: Math.PI * 1.5, // 270 degree FOV

	// Influence (OFF by default)
	hyperbolicInfluence: false,
	influenceSteepness: 8,

	// Flow (OFF by default)
	flowField: false,
	flowStrength: 0.1,
	windDirection: 0,
	windStrength: 0,
	turbulence: false,
	turbulenceStrength: 0.05,

	// Visual (OFF by default)
	visualFiber: false,
} as const;

// =============================================================================
// Flow Field Types
// =============================================================================

/**
 * A single cell in the flow field grid.
 */
export interface FlowCell {
	/** Force vector at this cell */
	readonly force: V2D;
}

/**
 * Configuration for a thermal (circular upward flow).
 */
export interface ThermalConfig {
	/** Center X position */
	readonly x: number;
	/** Center Y position */
	readonly y: number;
	/** Radius of effect */
	readonly radius: number;
	/** Upward force strength */
	readonly strength: number;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * GGDP-specific event payloads.
 */
export interface GGDPEventPayloads {
	'ggdp:toggle': { dimension: DimensionName; enabled: boolean };
	'ggdp:metrics': AggregateMetrics;
	'ggdp:configChange': { key: keyof GGDPConfig; value: unknown };
}

