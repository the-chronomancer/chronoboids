/**
 * PerformanceDashboard - Real-time GGDP performance metrics display.
 *
 * Shows the impact of each dimensional optimization with live updates.
 */

import { ggdpManager } from '../ggdp/GGDPManager.js';
import type { DimensionName, AggregateMetrics } from '../ggdp/types.js';

/**
 * Display names for each dimension.
 */
const DIMENSION_DISPLAY_NAMES: Record<DimensionName, string> = {
	spatial: 'Spatial Hash',
	morton: 'Morton Order',
	temporal: 'Time Wheel',
	'hierarchical-temporal': 'Hierarchical Time',
	perceptual: 'Geodesic',
	influence: 'Hyperbolic',
	flow: 'Flow Field',
	visual: 'Visual Fiber',
};

/**
 * Manages the performance dashboard UI.
 */
export class PerformanceDashboard {
	private container: HTMLElement | null = null;
	private readonly metricsElements = new Map<DimensionName, HTMLElement>();
	private summaryElement: HTMLElement | null = null;
	private visible = false;

	/**
	 * Initializes the dashboard, creating DOM elements.
	 */
	public init(): void {
		// Create dashboard container
		this.container = document.createElement('div');
		this.container.id = 'ggdp-dashboard';
		this.container.setAttribute('role', 'region');
		this.container.setAttribute('aria-label', 'GGDP Performance Dashboard');

		// Create header
		const header = document.createElement('h4');
		header.textContent = 'GGDP Performance';
		this.container.appendChild(header);

		// Create metric rows for each dimension
		const dimensions: DimensionName[] = [
			'spatial',
			'morton',
			'temporal',
			'hierarchical-temporal',
			'perceptual',
			'influence',
			'flow',
			'visual',
		];

		for (const dim of dimensions) {
			const row = document.createElement('div');
			row.className = 'metric-row';

			const nameSpan = document.createElement('span');
			nameSpan.className = 'metric-name';
			nameSpan.textContent = DIMENSION_DISPLAY_NAMES[dim];

			const valueSpan = document.createElement('span');
			valueSpan.className = 'metric-value';
			valueSpan.textContent = '--';
			valueSpan.dataset.dimension = dim;

			row.appendChild(nameSpan);
			row.appendChild(valueSpan);
			this.container.appendChild(row);

			this.metricsElements.set(dim, valueSpan);
		}

		// Create summary section
		this.summaryElement = document.createElement('div');
		this.summaryElement.className = 'summary';
		this.summaryElement.textContent = 'FPS: -- | Boids: -- | Checks: --';
		this.container.appendChild(this.summaryElement);

		// Add to DOM
		document.body.appendChild(this.container);
	}

	/**
	 * Shows the dashboard.
	 */
	public show(): void {
		this.visible = true;
		this.container?.classList.add('visible');
	}

	/**
	 * Hides the dashboard.
	 */
	public hide(): void {
		this.visible = false;
		this.container?.classList.remove('visible');
	}

	/**
	 * Toggles dashboard visibility.
	 */
	public toggle(): void {
		if (this.visible) {
			this.hide();
		} else {
			this.show();
		}
	}

	/**
	 * Updates the dashboard with current metrics.
	 */
	public update(boidCount: number): void {
		if (!this.visible || this.container === null) return;

		const metrics = ggdpManager.getAggregateMetrics();

		// Update dimension metrics
		for (const dimMetric of metrics.dimensions) {
			const element = this.metricsElements.get(dimMetric.name);
			if (element !== undefined) {
				element.textContent = dimMetric.enabled ? dimMetric.impact : 'OFF';
				element.classList.toggle('enabled', dimMetric.enabled);
				element.classList.toggle('disabled', !dimMetric.enabled);
			}
		}

		// Update inline metrics in settings panel
		this.updateInlineMetrics(metrics);

		// Update summary
		if (this.summaryElement !== null) {
			const fps = metrics.fps.toFixed(1);
			const checks = this.formatNumber(metrics.neighborChecks);
			this.summaryElement.textContent = `FPS: ${fps} | Boids: ${boidCount} | Checks: ${checks}`;
		}

		// Update debug panel elements
		this.updateDebugPanel(metrics);
	}

	/**
	 * Updates inline metric displays in the settings panel.
	 */
	private updateInlineMetrics(metrics: AggregateMetrics): void {
		for (const dimMetric of metrics.dimensions) {
			const element = document.querySelector(`[data-metric="${dimMetric.name}"]`);
			if (element !== null) {
				element.textContent = dimMetric.enabled ? dimMetric.impact : '';
			}
		}
	}

	/**
	 * Updates the debug panel elements.
	 */
	private updateDebugPanel(metrics: AggregateMetrics): void {
		const checksEl = document.getElementById('neighbor-checks');
		if (checksEl !== null) {
			checksEl.textContent = this.formatNumber(metrics.neighborChecks);
		}

		const physicsEl = document.getElementById('physics-time');
		if (physicsEl !== null) {
			physicsEl.textContent = metrics.physicsTimeMs.toFixed(2);
		}
	}

	/**
	 * Formats a number with K/M suffixes for readability.
	 */
	private formatNumber(n: number): string {
		if (n >= 1_000_000) {
			return (n / 1_000_000).toFixed(1) + 'M';
		}
		if (n >= 1_000) {
			return (n / 1_000).toFixed(1) + 'K';
		}
		return n.toString();
	}

	/**
	 * Destroys the dashboard.
	 */
	public destroy(): void {
		this.container?.remove();
		this.container = null;
		this.metricsElements.clear();
		this.summaryElement = null;
	}
}

/**
 * Singleton instance.
 */
export const performanceDashboard = new PerformanceDashboard();

