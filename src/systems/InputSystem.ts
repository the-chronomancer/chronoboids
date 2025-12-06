/**
 * InputSystem - Handles mouse, touch, and keyboard input.
 *
 * Uses the EventBus for decoupled communication with other systems.
 * All DOM event handlers are centralized here.
 */

import { eventBus } from '../core/EventBus.js';
import type { InputState } from '../core/types.js';

/**
 * Manages all input handling for the simulation.
 */
export class InputSystem {
	/** Current input state */
	private readonly state: InputState = {
		x: 0,
		y: 0,
		down: false,
		over: true,
		button: 0,
	};

	/** Canvas element for event binding */
	private readonly canvas: HTMLCanvasElement;

	/** UI container element */
	private readonly container: HTMLElement | null;

	/** Double-tap detection for touch */
	private lastTapTime = 0;

	/** Bound event handlers for cleanup */
	private readonly boundHandlers: {
		mousedown: (e: MouseEvent) => void;
		mouseup: () => void;
		mousemove: (e: MouseEvent) => void;
		touchstart: (e: TouchEvent) => void;
		touchend: () => void;
		touchmove: (e: TouchEvent) => void;
		dblclick: () => void;
		keydown: (e: KeyboardEvent) => void;
		resize: () => void;
		contextmenu: (e: Event) => void;
	};

	/**
	 * Creates a new input system.
	 * @param canvas - The PIXI canvas element
	 * @param containerId - ID of the UI container element
	 */
	public constructor(canvas: HTMLCanvasElement, containerId = 'container') {
		this.canvas = canvas;
		this.container = document.getElementById(containerId);

		// Bind handlers to preserve `this` context
		this.boundHandlers = {
			mousedown: this.handleMouseDown.bind(this),
			mouseup: this.handleMouseUp.bind(this),
			mousemove: this.handleMouseMove.bind(this),
			touchstart: this.handleTouchStart.bind(this),
			touchend: this.handleMouseUp.bind(this),
			touchmove: this.handleTouchMove.bind(this),
			dblclick: this.handleDoubleClick.bind(this),
			keydown: this.handleKeyDown.bind(this),
			resize: this.handleResize.bind(this),
			contextmenu: this.preventDefault.bind(this),
		};

		this.setupEventListeners();
	}

	// ==========================================================================
	// Event Listener Setup
	// ==========================================================================

	/**
	 * Sets up all event listeners.
	 */
	private setupEventListeners(): void {
		// Mouse events
		document.addEventListener('mousedown', this.boundHandlers.mousedown);
		document.addEventListener('mouseup', this.boundHandlers.mouseup);
		document.addEventListener('mousemove', this.boundHandlers.mousemove);
		document.addEventListener('dblclick', this.boundHandlers.dblclick);

		// Touch events
		document.addEventListener('touchstart', this.boundHandlers.touchstart);
		document.addEventListener('touchend', this.boundHandlers.touchend);
		document.addEventListener('touchmove', this.boundHandlers.touchmove);

		// Keyboard events
		document.addEventListener('keydown', this.boundHandlers.keydown);

		// Window events
		window.addEventListener('resize', this.boundHandlers.resize);

		// Context menu prevention
		this.canvas.addEventListener('contextmenu', this.boundHandlers.contextmenu);
		this.container?.addEventListener('contextmenu', this.boundHandlers.contextmenu);

		// Container hover tracking
		this.container?.addEventListener('mouseover', () => {
			this.state.over = false;
		});
		this.container?.addEventListener('mouseout', () => {
			this.state.over = true;
		});
	}

	// ==========================================================================
	// Event Handlers
	// ==========================================================================

	private handleMouseDown(e: MouseEvent): void {
		this.state.x = e.clientX;
		this.state.y = e.clientY;
		this.state.down = true;
		this.state.button = e.button;

		// Check for menu toggle (top-right corner or middle click)
		const width = window.innerWidth;
		if ((e.button === 0 && this.state.x >= width - 50 && this.state.y <= 40) || e.button === 1) {
			eventBus.emit('ui:toggleMenu', undefined);
			e.preventDefault();
		}

		eventBus.emit('input:mousedown', { ...this.state });
	}

	private handleMouseUp(): void {
		this.state.down = false;
		eventBus.emit('input:mouseup', undefined);
	}

	private handleMouseMove(e: MouseEvent): void {
		this.state.x = e.clientX;
		this.state.y = e.clientY;
		eventBus.emit('input:mousemove', { x: this.state.x, y: this.state.y });
	}

	private handleTouchStart(e: TouchEvent): void {
		const touch = e.touches[0];
		if (touch === undefined) return;

		this.state.x = touch.clientX;
		this.state.y = touch.clientY;
		this.state.down = true;
		this.state.button = 0;

		// Double-tap detection
		const now = e.timeStamp;
		if (now - this.lastTapTime < 500) {
			this.handleDoubleClick();
		}
		this.lastTapTime = now;

		eventBus.emit('input:mousedown', { ...this.state });
	}

	private handleTouchMove(e: TouchEvent): void {
		const touch = e.touches[0];
		if (touch === undefined) return;

		this.state.x = touch.clientX;
		this.state.y = touch.clientY;
		eventBus.emit('input:mousemove', { x: this.state.x, y: this.state.y });
	}

	private handleDoubleClick(): void {
		if (this.state.over) {
			eventBus.emit('input:doubleclick', { x: this.state.x, y: this.state.y });
		}
	}

	private handleKeyDown(e: KeyboardEvent): void {
		eventBus.emit('input:keydown', { key: e.key });

		// Built-in shortcuts
		if (e.key === ' ') {
			eventBus.emit('ui:togglePause', undefined);
			e.preventDefault();
		}
	}

	private handleResize(): void {
		eventBus.emit('simulation:resize', {
			width: window.innerWidth,
			height: window.innerHeight,
		});
	}

	private preventDefault(e: Event): void {
		e.preventDefault();
	}

	// ==========================================================================
	// Public API
	// ==========================================================================

	/**
	 * Gets the current input state (read-only).
	 */
	public getState(): Readonly<InputState> {
		return this.state;
	}

	/**
	 * Cleans up event listeners.
	 */
	public destroy(): void {
		document.removeEventListener('mousedown', this.boundHandlers.mousedown);
		document.removeEventListener('mouseup', this.boundHandlers.mouseup);
		document.removeEventListener('mousemove', this.boundHandlers.mousemove);
		document.removeEventListener('dblclick', this.boundHandlers.dblclick);
		document.removeEventListener('touchstart', this.boundHandlers.touchstart);
		document.removeEventListener('touchend', this.boundHandlers.touchend);
		document.removeEventListener('touchmove', this.boundHandlers.touchmove);
		document.removeEventListener('keydown', this.boundHandlers.keydown);
		window.removeEventListener('resize', this.boundHandlers.resize);
		this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextmenu);
		this.container?.removeEventListener('contextmenu', this.boundHandlers.contextmenu);
	}
}

