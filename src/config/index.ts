/**
 * Config module exports.
 */

export { DEFAULT_CONFIG, createDefaultConfig, SLIDER_CONFIGS, CHECKBOX_KEYS } from './defaults.js';
export type { SliderConfig } from './defaults.js';

export {
	serializeSettings,
	deserializeSettings,
	mergeSettings,
	isValidConfig,
} from './serialization.js';

export { ConfigManager, configManager } from './SimulationConfig.js';

