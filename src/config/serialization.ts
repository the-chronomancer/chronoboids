/**
 * Settings serialization for import/export functionality.
 *
 * Settings are encoded as base64 strings with a compact key format
 * to minimize URL/clipboard size.
 */

import type { SimulationConfig, SettingsEncodingMap } from '../core/types.js';
import { DEFAULT_CONFIG } from './defaults.js';

/**
 * Encoding map: full key name -> short code.
 * Single letters to minimize encoded string size.
 */
const ENCODE_MAP: SettingsEncodingMap = {
	menu: 'a',
	paused: 'b',
	boids: 'c',
	toggle: 'd',
	desired: 'e',
	hideBoids: 'x',
	hues: 'f',
	areas: 'g',
	outlines: 'h',
	halfAreas: 'y',
	bounce: 'i',
	particle: 'j',
	accuracyPower: 'k',
	vision: 'l',
	alignment: 'm',
	bias: 'n',
	cohesion: 'o',
	separation: 'p',
	maxForce: 'q',
	minSpeed: 'r',
	maxSpeed: 's',
	drag: 't',
	noise: 'u',
	debug: 'v',
	buckets: 'w',
	accuracy: 'z', // Derived value, included for compatibility
	// GGDP settings
	showFlowField: 'A',
	spatialHash: 'B',
	mortonOrder: 'C',
	timeWheel: 'D',
	timeWheelSlots: 'E',
	hierarchicalTimeWheel: 'O',
	activityThreshold: 'P',
	geodesicPerception: 'F',
	blindSpotAngle: 'G',
	hyperbolicInfluence: 'H',
	flowField: 'I',
	flowStrength: 'J',
	windDirection: 'K',
	windStrength: 'L',
	turbulence: 'M',
	visualFiber: 'N',
};

/**
 * Decode map: short code -> full key name.
 */
const DECODE_MAP: Record<string, keyof SimulationConfig> = Object.fromEntries(
	Object.entries(ENCODE_MAP).map(([key, code]) => [code, key as keyof SimulationConfig])
) as Record<string, keyof SimulationConfig>;

/**
 * Serializes settings to a base64 string.
 *
 * @param config - The configuration to serialize
 * @returns Base64 encoded settings string
 */
export function serializeSettings(config: SimulationConfig): string {
	const parts: string[] = [];

	for (const key of Object.keys(config) as (keyof SimulationConfig)[]) {
		const code = ENCODE_MAP[key];
		const value = config[key];

		if (typeof value === 'boolean') {
			parts.push(`${code}=${value ? '1' : '0'}`);
		} else {
			parts.push(`${code}=${String(value)}`);
		}
	}

	return btoa(parts.join('|'));
}

/**
 * Deserializes settings from a base64 string.
 *
 * @param encoded - Base64 encoded settings string
 * @returns Partial configuration with decoded values, or null if invalid
 */
export function deserializeSettings(encoded: string): Partial<SimulationConfig> | null {
	try {
		const decoded = atob(encoded.trim());
		const parts = decoded.split('|');
		const result: Partial<SimulationConfig> = {};

		for (const part of parts) {
			const eqIndex = part.indexOf('=');
			if (eqIndex === -1) continue;

			const code = part.slice(0, eqIndex);
			const value = part.slice(eqIndex + 1);

			const key = DECODE_MAP[code];
			if (key === undefined) continue;

			const defaultValue = DEFAULT_CONFIG[key];

			if (typeof defaultValue === 'boolean') {
				(result as Record<string, unknown>)[key] = value !== '0';
			} else if (typeof defaultValue === 'number') {
				const parsed = parseFloat(value);
				if (!isNaN(parsed)) {
					(result as Record<string, unknown>)[key] = parsed;
				}
			}
		}

		// Recompute derived values
		if (result.accuracyPower !== undefined) {
			const power = result.accuracyPower;
			(result as { accuracy?: number }).accuracy = power >= 10 ? 0 : Math.pow(2, power);
		}

		return result;
	} catch {
		console.warn('Failed to decode settings string');
		return null;
	}
}

/**
 * Merges partial settings into a complete configuration.
 *
 * @param partial - Partial settings to apply
 * @param base - Base configuration (defaults to DEFAULT_CONFIG)
 * @returns Complete merged configuration
 */
export function mergeSettings(
	partial: Partial<SimulationConfig>,
	base: SimulationConfig = DEFAULT_CONFIG
): SimulationConfig {
	return { ...base, ...partial };
}

/**
 * Validates that a configuration has all required fields.
 *
 * @param config - Configuration to validate
 * @returns True if valid
 */
export function isValidConfig(config: unknown): config is SimulationConfig {
	if (typeof config !== 'object' || config === null) {
		return false;
	}

	const obj = config as Record<string, unknown>;

	for (const key of Object.keys(DEFAULT_CONFIG)) {
		if (!(key in obj)) {
			return false;
		}

		const defaultValue = DEFAULT_CONFIG[key as keyof SimulationConfig];
		const actualValue = obj[key];

		if (typeof defaultValue !== typeof actualValue) {
			return false;
		}
	}

	return true;
}

