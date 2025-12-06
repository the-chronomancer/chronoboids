/**
 * SettingsPanel - UI binding for simulation settings.
 *
 * Handles:
 * - Checkbox and slider bindings
 * - Import/export functionality
 * - UI state management
 */

import { configManager } from '../config/SimulationConfig.js';
import { eventBus } from '../core/EventBus.js';
import { select, setText, toggleClass, setChecked } from '../utils/dom.js';
import type { SimulationConfig } from '../core/types.js';

/**
 * Initializes the settings panel UI bindings.
 */
export function initSettingsPanel(): void {
	// Bind checkboxes
	const checkboxes = document.querySelectorAll<HTMLInputElement>(
		'input[type=checkbox][data-model]'
	);

	for (const checkbox of checkboxes) {
		const model = checkbox.dataset.model as keyof SimulationConfig | undefined;
		if (model === undefined) continue;

		// Set initial state
		const value = configManager.config[model];
		if (typeof value === 'boolean') {
			checkbox.checked = value;
		}

		// Bind change handler
		checkbox.addEventListener('input', () => {
			configManager.set(model, checkbox.checked as SimulationConfig[typeof model]);

			// Special handling for toggle
			if (model === 'toggle') {
				const img = select('#toggler img');
				img?.classList.toggle('gone', checkbox.checked);
			}
		});
	}

	// Bind sliders
	const sliders = document.querySelectorAll<HTMLInputElement>('input[type=range][data-model]');

	for (const slider of sliders) {
		const model = slider.dataset.model as keyof SimulationConfig | undefined;
		if (model === undefined) continue;

		// Set initial state
		const value = configManager.config[model];
		if (typeof value === 'number') {
			slider.value = String(value);
			setText(`[data-show=${model}]`, value);
		}

		// Bind change handler
		slider.addEventListener('input', () => {
			const newValue = parseFloat(slider.value);
			configManager.set(model, newValue as SimulationConfig[typeof model]);

			// Update display
			if (model === 'accuracyPower') {
				setText('[data-show=accuracy]', Math.floor(configManager.config.accuracy));
			} else {
				setText(`[data-show=${model}]`, newValue);
			}

			// Special handling for maxSpeed affecting minSpeed
			if (model === 'maxSpeed') {
				const minSlider = select('[data-model=minSpeed]') as HTMLInputElement | null;
				if (minSlider !== null) {
					minSlider.max = String(newValue);
					if (configManager.config.minSpeed > newValue) {
						minSlider.value = String(newValue);
					}
				}
			}
		});
	}

	// Bind click handlers
	bindClickHandlers();

	// Listen for config changes from other sources
	eventBus.on('config:change', ({ key, value }) => {
		updateUIForKey(key, value);
	});
}

/**
 * Binds click handlers for buttons.
 */
function bindClickHandlers(): void {
	function leaveMenu(): void {
		toggleClass('#popupwindow', 'visible', false);
		toggleClass('#export-popup', 'visible', false);
		toggleClass('#import-popup', 'visible', false);
	}

	const handlers: Record<string, () => void | Promise<void>> = {
		restart: () => {
			eventBus.emit('simulation:reset', undefined);
		},

		reset: () => {
			configManager.reset();
			updateAllUI();
		},

		next: () => {
			eventBus.emit('input:keydown', { key: '.' });
		},

		exportSave: () => {
			const encoded = configManager.export();
			const exporter = select('#exporter') as HTMLTextAreaElement | null;
			if (exporter !== null) {
				exporter.value = encoded;
			}
			toggleClass('#export-popup', 'visible', true);
			toggleClass('#popupwindow', 'visible', true);
		},

		leaveMenu,

		importMenu: () => {
			const importer = select('#importer') as HTMLTextAreaElement | null;
			if (importer !== null) {
				importer.value = '';
			}
			toggleClass('#import-popup', 'visible', true);
			toggleClass('#popupwindow', 'visible', true);
		},

		importSave: () => {
			const importer = select('#importer') as HTMLTextAreaElement | null;
			if (importer !== null && importer.value.trim() !== '') {
				const success = configManager.import(importer.value);
				if (success) {
					leaveMenu();
					updateAllUI();
				}
			}
		},

		copy: async () => {
			const exporter = select('#exporter') as HTMLTextAreaElement | null;
			if (exporter !== null) {
				try {
					await navigator.clipboard.writeText(exporter.value);
				} catch {
					// Fallback for older browsers
					exporter.select();
					exporter.setSelectionRange(0, 99999);
				}
			}
		},

		toggleMenu: () => {
			eventBus.emit('ui:toggleMenu', undefined);
		},
	};

	const buttons = document.querySelectorAll<HTMLElement>('[data-click]');
	for (const button of buttons) {
		const action = button.dataset.click;
		if (action !== undefined && action in handlers) {
			button.addEventListener('click', () => {
				const handler = handlers[action];
				if (handler !== undefined) {
					void handler();
				}
			});
		}
	}
}

/**
 * Updates UI for a specific config key.
 */
function updateUIForKey(key: keyof SimulationConfig, value: unknown): void {
	// Update checkbox
	const checkbox = select(`input[type=checkbox][data-model=${key}]`) as HTMLInputElement | null;
	if (checkbox !== null && typeof value === 'boolean') {
		checkbox.checked = value;
	}

	// Update slider
	const slider = select(`input[type=range][data-model=${key}]`) as HTMLInputElement | null;
	if (slider !== null && typeof value === 'number') {
		slider.value = String(value);
	}

	// Update display
	if (key === 'accuracyPower') {
		setText('[data-show=accuracy]', Math.floor(configManager.config.accuracy));
	} else if (typeof value === 'number') {
		setText(`[data-show=${key}]`, value);
	}

	// Special handling for toggle
	if (key === 'toggle' && typeof value === 'boolean') {
		const img = select('#toggler img');
		img?.classList.toggle('gone', value);
	}

	// Special handling for menu
	if (key === 'menu' && typeof value === 'boolean') {
		toggleClass('#container', 'hidden', !value);
		toggleClass('#toggler', 'hidden', !value);
	}

	// Special handling for paused
	if (key === 'paused' && typeof value === 'boolean') {
		setChecked('#pauseButton', value);
	}
}

/**
 * Updates all UI elements to match current config.
 */
function updateAllUI(): void {
	const config = configManager.config;

	// Update all checkboxes
	const checkboxes = document.querySelectorAll<HTMLInputElement>(
		'input[type=checkbox][data-model]'
	);
	for (const checkbox of checkboxes) {
		const model = checkbox.dataset.model as keyof SimulationConfig | undefined;
		if (model !== undefined) {
			const value = config[model];
			if (typeof value === 'boolean') {
				checkbox.checked = value;
			}
		}
	}

	// Update all sliders
	const sliders = document.querySelectorAll<HTMLInputElement>('input[type=range][data-model]');
	for (const slider of sliders) {
		const model = slider.dataset.model as keyof SimulationConfig | undefined;
		if (model !== undefined) {
			const value = config[model];
			if (typeof value === 'number') {
				slider.value = String(value);
				if (model === 'accuracyPower') {
					setText('[data-show=accuracy]', Math.floor(config.accuracy));
				} else {
					setText(`[data-show=${model}]`, value);
				}
			}
		}
	}

	// Update toggle image
	const img = select('#toggler img');
	img?.classList.toggle('gone', config.toggle);

	// Force shape mode update
	configManager.invalidateShapes();
}

/**
 * Toggles the menu visibility.
 */
export function toggleMenu(): void {
	configManager.toggle('menu');
	toggleClass('#container', 'hidden', !configManager.config.menu);
	toggleClass('#toggler', 'hidden', !configManager.config.menu);
}

/**
 * Toggles the pause state.
 */
export function togglePause(): void {
	configManager.toggle('paused');
	setChecked('#pauseButton', configManager.paused);
}
