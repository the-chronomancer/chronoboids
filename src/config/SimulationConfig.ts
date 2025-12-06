/**
 * SimulationConfig - Reactive configuration management.
 *
 * This class wraps the configuration state and provides:
 * - Type-safe getters/setters
 * - Change notifications via EventBus
 * - Derived value computation (e.g., accuracy from accuracyPower)
 */

import type { SimulationConfig, MutableSimulationConfig } from '../core/types.js';
import { eventBus } from '../core/EventBus.js';
import { DEFAULT_CONFIG, createDefaultConfig } from './defaults.js';
import { serializeSettings, deserializeSettings, mergeSettings } from './serialization.js';

/**
 * Manages simulation configuration with change notifications.
 */
export class ConfigManager {
	/** Internal mutable state */
	private readonly state: MutableSimulationConfig;

	/** Track shape-affecting changes */
	private _shapeMode = 0;

	/**
	 * Creates a new config manager with default values.
	 */
	public constructor(initial?: Partial<SimulationConfig>) {
		this.state = createDefaultConfig() as MutableSimulationConfig;

		if (initial !== undefined) {
			Object.assign(this.state, initial);
		}
	}

	// ==========================================================================
	// Getters (Read-only access to state)
	// ==========================================================================

	public get config(): Readonly<SimulationConfig> {
		return this.state;
	}

	public get shapeMode(): number {
		return this._shapeMode;
	}

	// Convenience getters for frequently accessed values
	public get paused(): boolean {
		return this.state.paused;
	}
	public get boids(): number {
		return this.state.boids;
	}
	public get vision(): number {
		return this.state.vision;
	}
	public get maxSpeed(): number {
		return this.state.maxSpeed;
	}
	public get minSpeed(): number {
		return this.state.minSpeed;
	}
	public get debug(): boolean {
		return this.state.debug;
	}

	// ==========================================================================
	// Setters (With change notifications)
	// ==========================================================================

	/**
	 * Sets a single configuration value.
	 * Emits a config:change event and handles derived values.
	 */
	public set<K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]): void {
		const oldValue = this.state[key];

		if (oldValue === value) {
			return;
		}

		this.state[key] = value;

		// Handle derived values
		if (key === 'accuracyPower') {
			const power = value as number;
			this.state.accuracy = power >= 10 ? 0 : Math.pow(2, power);
		}

		// Handle maxSpeed affecting minSpeed
		if (key === 'maxSpeed' && this.state.minSpeed > (value as number)) {
			this.state.minSpeed = value as number;
		}

		// Track shape-affecting changes
		if (this.isShapeAffectingKey(key)) {
			this._shapeMode++;
		}

		// Emit change event
		eventBus.emit('config:change', { key, value });
	}

	/**
	 * Sets multiple configuration values at once.
	 */
	public setMultiple(values: Partial<SimulationConfig>): void {
		for (const key of Object.keys(values) as (keyof SimulationConfig)[]) {
			const value = values[key];
			if (value !== undefined) {
				this.set(key, value);
			}
		}
	}

	/**
	 * Toggles a boolean configuration value.
	 */
	public toggle(key: keyof SimulationConfig): void {
		const current = this.state[key];
		if (typeof current === 'boolean') {
			this.set(key, !current as SimulationConfig[typeof key]);
		}
	}

	// ==========================================================================
	// Reset and Serialization
	// ==========================================================================

	/**
	 * Resets all settings to defaults.
	 */
	public reset(): void {
		const defaults = createDefaultConfig();
		for (const [key, value] of Object.entries(defaults)) {
			this.set(key as keyof SimulationConfig, value as SimulationConfig[keyof SimulationConfig]);
		}
	}

	/**
	 * Exports settings to a base64 string.
	 */
	public export(): string {
		return serializeSettings(this.state);
	}

	/**
	 * Imports settings from a base64 string.
	 * @returns True if import was successful
	 */
	public import(encoded: string): boolean {
		const partial = deserializeSettings(encoded);

		if (partial === null) {
			return false;
		}

		const merged = mergeSettings(partial, DEFAULT_CONFIG);
		this.setMultiple(merged);
		return true;
	}

	// ==========================================================================
	// Helpers
	// ==========================================================================

	/**
	 * Checks if a key affects boid shape rendering.
	 */
	private isShapeAffectingKey(key: keyof SimulationConfig): boolean {
		return (
			key === 'hideBoids' ||
			key === 'areas' ||
			key === 'outlines' ||
			key === 'halfAreas' ||
			key === 'vision'
		);
	}

	/**
	 * Increments shape mode to trigger re-renders.
	 */
	public invalidateShapes(): void {
		this._shapeMode++;
	}
}

/**
 * Singleton config manager instance.
 */
export const configManager = new ConfigManager();

