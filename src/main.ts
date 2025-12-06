/**
 * Main entry point for the Chronoboids simulation.
 *
 * This file initializes the application and starts the simulation.
 */

import { ChronoBoids } from './core/Application.js';
import { initSettingsPanel } from './ui/SettingsPanel.js';

/**
 * Bootstrap the application.
 */
async function main(): Promise<void> {
	// Check for reduced motion preference
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (prefersReducedMotion) {
		// eslint-disable-next-line no-console
		console.info('Reduced motion preference detected. Consider pausing on load.');
	}

	// Create and initialize the application
	const app = new ChronoBoids();

	try {
		await app.init();
	} catch (error) {
		console.error('Failed to initialize application:', error);

		// Show error message to user
		const errorDiv = document.createElement('div');
		errorDiv.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: #1a1a1a;
			color: #ff6b6b;
			padding: 2rem;
			border-radius: 8px;
			font-family: system-ui, sans-serif;
			text-align: center;
			max-width: 400px;
		`;
		errorDiv.innerHTML = `
			<h2>Failed to Initialize</h2>
			<p>The simulation could not start. This may be due to:</p>
			<ul style="text-align: left;">
				<li>WebGL not being supported</li>
				<li>Hardware acceleration being disabled</li>
				<li>Browser compatibility issues</li>
			</ul>
			<p>Try using a modern browser like Chrome, Firefox, or Edge.</p>
		`;
		document.body.appendChild(errorDiv);
		return;
	}

	// Initialize UI bindings
	initSettingsPanel();

	// Start the simulation
	app.start();

	// Expose app globally for debugging in development
	if (import.meta.env.DEV) {
		(window as unknown as { chronoboids: ChronoBoids }).chronoboids = app;
	}
}

// Run on DOM ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		void main();
	});
} else {
	void main();
}

