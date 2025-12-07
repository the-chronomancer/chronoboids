/**
 * Default configuration values for the simulation.
 */

import type { SimulationConfig } from '../core/types.js';

/**
 * Default simulation configuration.
 * These values provide a good starting point for the boids simulation.
 */
export const DEFAULT_CONFIG: Readonly<SimulationConfig> = {
	// UI State
	menu: true,
	paused: false,
	boids: 1500,

	// Visual Settings
	toggle: false,
	desired: false,
	hideBoids: false,
	hues: true,
	areas: false,
	outlines: false,
	halfAreas: false,

	// Physics Settings
	particle: false,
	bounce: false,
	accuracyPower: 5,
	accuracy: 32, // 2^5
	vision: 25,
	alignment: 1.1,
	bias: 1.5,
	cohesion: 1,
	separation: 1.1,
	maxForce: 0.2,
	minSpeed: 1,
	maxSpeed: 4,
	drag: 0.005,
	noise: 1,

	// Debug Settings
	debug: false,
	buckets: false,
	showFlowField: false,

	// GGDP Settings (Geometry-Guided Dynamic Programming)
	spatialHash: true, // ON by default - baseline optimization
	mortonOrder: false,
	timeWheel: false,
	timeWheelSlots: 16,
	hierarchicalTimeWheel: false,
	activityThreshold: 0.5, // Velocity below this = slower updates
	geodesicPerception: false,
	blindSpotAngle: 90, // degrees
	hyperbolicInfluence: false,
	flowField: false,
	flowStrength: 0.1,
	windDirection: 0, // degrees
	windStrength: 0,
	turbulence: false,
	visualFiber: false,
} as const;

/**
 * Creates a mutable copy of the default configuration.
 */
export function createDefaultConfig(): SimulationConfig {
	return { ...DEFAULT_CONFIG };
}

/**
 * Slider configuration for UI controls.
 */
export interface SliderConfig {
	readonly min: number;
	readonly max: number;
	readonly step: number;
	readonly key: keyof SimulationConfig;
}

/**
 * Slider configurations for each adjustable setting.
 */
export const SLIDER_CONFIGS: Record<string, SliderConfig> = {
	boids: { min: 50, max: 5000, step: 50, key: 'boids' },
	accuracyPower: { min: 2.25, max: 10, step: 0.25, key: 'accuracyPower' },
	vision: { min: 0, max: 150, step: 5, key: 'vision' },
	alignment: { min: 0, max: 4, step: 0.1, key: 'alignment' },
	bias: { min: 0.25, max: 4, step: 0.05, key: 'bias' },
	cohesion: { min: 0, max: 4, step: 0.1, key: 'cohesion' },
	separation: { min: 0, max: 4, step: 0.1, key: 'separation' },
	maxForce: { min: 0, max: 1, step: 0.05, key: 'maxForce' },
	minSpeed: { min: 0, max: 4, step: 0.05, key: 'minSpeed' },
	maxSpeed: { min: 0, max: 12, step: 0.25, key: 'maxSpeed' },
	drag: { min: 0, max: 0.05, step: 0.001, key: 'drag' },
	noise: { min: 0, max: 10, step: 0.5, key: 'noise' },
	// GGDP Sliders
	timeWheelSlots: { min: 4, max: 32, step: 4, key: 'timeWheelSlots' },
	activityThreshold: { min: 0.1, max: 2, step: 0.1, key: 'activityThreshold' },
	blindSpotAngle: { min: 0, max: 180, step: 15, key: 'blindSpotAngle' },
	flowStrength: { min: 0, max: 1, step: 0.05, key: 'flowStrength' },
	windDirection: { min: 0, max: 360, step: 15, key: 'windDirection' },
	windStrength: { min: 0, max: 1, step: 0.05, key: 'windStrength' },
} as const;

/**
 * Checkbox configuration for UI controls.
 */
export const CHECKBOX_KEYS: readonly (keyof SimulationConfig)[] = [
	'toggle',
	'desired',
	'hideBoids',
	'hues',
	'areas',
	'outlines',
	'halfAreas',
	'particle',
	'bounce',
	'debug',
	'buckets',
	'showFlowField',
	'paused',
	// GGDP Checkboxes
	'spatialHash',
	'mortonOrder',
	'timeWheel',
	'hierarchicalTimeWheel',
	'geodesicPerception',
	'hyperbolicInfluence',
	'flowField',
	'turbulence',
	'visualFiber',
] as const;

