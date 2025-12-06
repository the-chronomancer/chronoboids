/**
 * Core type definitions for the Chronoboids simulation.
 * These interfaces define the contracts between different modules.
 */

import type { Application, Container, Graphics } from 'pixi.js';

// =============================================================================
// Vector Types
// =============================================================================

/**
 * Represents a 2D point or vector with x and y components.
 */
export interface IVector2D {
	x: number;
	y: number;
}

/**
 * Read-only version of IVector2D for immutable operations.
 */
export interface IReadonlyVector2D {
	readonly x: number;
	readonly y: number;
}

// =============================================================================
// Simulation Configuration
// =============================================================================

/**
 * Visual settings for the simulation display.
 */
export interface VisualSettings {
	/** Whether the settings menu is visible */
	readonly menu: boolean;
	/** Whether to show desired direction vectors */
	readonly desired: boolean;
	/** Whether to completely hide boid shapes */
	readonly hideBoids: boolean;
	/** Whether to color boids based on speed */
	readonly hues: boolean;
	/** Whether to show vision area fills */
	readonly areas: boolean;
	/** Whether to show vision area outlines */
	readonly outlines: boolean;
	/** Whether to halve the shown vision area size */
	readonly halfAreas: boolean;
	/** Whether to hide the menu toggle arrow */
	readonly toggle: boolean;
}

/**
 * Physics/movement settings for boid behavior.
 */
export interface PhysicsSettings {
	/** Enable particle mode (no flocking) */
	readonly particle: boolean;
	/** Bounce off edges instead of wrapping */
	readonly bounce: boolean;
	/** Maximum boids to check per frame (0 = unlimited) */
	readonly accuracy: number;
	/** Power value for accuracy calculation (2^accuracyPower) */
	readonly accuracyPower: number;
	/** Vision radius for neighbor detection */
	readonly vision: number;
	/** Alignment force multiplier */
	readonly alignment: number;
	/** Alignment bias (>1 favors same direction) */
	readonly bias: number;
	/** Cohesion force multiplier */
	readonly cohesion: number;
	/** Separation force multiplier */
	readonly separation: number;
	/** Maximum steering force */
	readonly maxForce: number;
	/** Minimum speed */
	readonly minSpeed: number;
	/** Maximum speed */
	readonly maxSpeed: number;
	/** Drag coefficient (0-1) */
	readonly drag: number;
	/** Movement randomness */
	readonly noise: number;
}

/**
 * Debug settings for development.
 */
export interface DebugSettings {
	/** Show debug information */
	readonly debug: boolean;
	/** Show spatial subdivision grid */
	readonly buckets: boolean;
}

/**
 * Complete simulation configuration.
 */
export interface SimulationConfig extends VisualSettings, PhysicsSettings, DebugSettings {
	/** Whether simulation is paused */
	readonly paused: boolean;
	/** Number of boids in simulation */
	readonly boids: number;
}

/**
 * Mutable version of SimulationConfig for internal state management.
 */
export type MutableSimulationConfig = {
	-readonly [K in keyof SimulationConfig]: SimulationConfig[K];
};

// =============================================================================
// Boid Types
// =============================================================================

/**
 * Core boid data (position, velocity, acceleration).
 */
export interface BoidData extends IVector2D {
	/** Velocity vector */
	readonly velocity: IVector2D;
	/** Acceleration vector */
	readonly acceleration: IVector2D;
	/** Unique index in the flock */
	readonly index: number;
}

/**
 * Neighbor information for flocking calculations.
 */
export interface NeighborData {
	/** The neighboring boid */
	readonly boid: BoidData;
	/** Squared distance to the neighbor */
	readonly sqrDistance: number;
}

// =============================================================================
// Spatial Partitioning Types
// =============================================================================

/**
 * A cell in the spatial hash grid.
 */
export interface SpatialCell<T> {
	/** Items in this cell */
	readonly items: T[];
	/** Row index */
	readonly row: number;
	/** Column index */
	readonly col: number;
}

/**
 * Configuration for spatial hashing.
 */
export interface SpatialHashConfig {
	/** Cell size (should match vision radius) */
	readonly cellSize: number;
	/** World width */
	readonly width: number;
	/** World height */
	readonly height: number;
}

// =============================================================================
// Rendering Types
// =============================================================================

/**
 * PIXI.js application context.
 */
export interface RenderContext {
	/** The PIXI Application instance */
	readonly app: Application;
	/** The main stage container */
	readonly stage: Container;
	/** Current canvas width */
	readonly width: number;
	/** Current canvas height */
	readonly height: number;
}

/**
 * Boid visual representation.
 */
export interface BoidVisual {
	/** Main shape graphics */
	readonly shape: Graphics;
	/** Desired direction indicator */
	readonly desired: Graphics;
	/** Current shape mode (for dirty checking) */
	shapeMode: number;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Mouse/touch input state.
 */
export interface InputState {
	/** Current X position */
	x: number;
	/** Current Y position */
	y: number;
	/** Whether primary button is pressed */
	down: boolean;
	/** Whether cursor is over the canvas (not UI) */
	over: boolean;
	/** Which button is pressed (0=left, 2=right) */
	button: number;
}

/**
 * Explosion effect state.
 */
export interface ExplosionState {
	/** Current explosion intensity (0-1) */
	intensity: number;
	/** Explosion center position */
	readonly position: IVector2D;
}

// =============================================================================
// Global State Types
// =============================================================================

/**
 * Runtime globals that change each frame.
 */
export interface RuntimeState {
	/** Computed mouse force based on settings */
	mouseForce: number;
	/** Squared vision radius (cached) */
	sqVis: number;
	/** Current frame delta time */
	delta: number;
	/** Current shape mode for dirty checking */
	shapeMode: number;
	/** Computed noise range in radians */
	noiseRange: number;
	/** Current FPS (exponential moving average) */
	fps: number;
	/** Whether to advance one frame when paused */
	nextFrame: boolean;
	/** Current canvas width */
	width: number;
	/** Current canvas height */
	height: number;
	/** Mouse input state */
	readonly mouse: InputState;
	/** Explosion effect state */
	readonly explosion: ExplosionState;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event names used by the EventBus.
 */
export type EventName =
	| 'simulation:start'
	| 'simulation:stop'
	| 'simulation:reset'
	| 'simulation:resize'
	| 'config:change'
	| 'input:mousedown'
	| 'input:mouseup'
	| 'input:mousemove'
	| 'input:doubleclick'
	| 'input:keydown'
	| 'ui:toggleMenu'
	| 'ui:togglePause';

/**
 * Event payload types mapped to event names.
 */
export interface EventPayloads {
	'simulation:start': undefined;
	'simulation:stop': undefined;
	'simulation:reset': undefined;
	'simulation:resize': { width: number; height: number };
	'config:change': { key: keyof SimulationConfig; value: unknown };
	'input:mousedown': InputState;
	'input:mouseup': undefined;
	'input:mousemove': { x: number; y: number };
	'input:doubleclick': { x: number; y: number };
	'input:keydown': { key: string };
	'ui:toggleMenu': undefined;
	'ui:togglePause': undefined;
}

/**
 * Generic event listener type.
 */
export type EventListener<T extends EventName> = (payload: EventPayloads[T]) => void;

// =============================================================================
// Serialization Types
// =============================================================================

/**
 * Encoding map for settings serialization.
 */
export type SettingsEncodingMap = Record<keyof SimulationConfig, string>;

/**
 * Serialized settings string format.
 */
export type SerializedSettings = string;

