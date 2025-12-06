/**
 * EventBus - A type-safe pub/sub system for decoupled module communication.
 *
 * This eliminates circular dependencies between modules by providing a central
 * communication channel. Modules subscribe to events they care about and emit
 * events when something happens, without needing direct references to each other.
 */

import type { EventName, EventPayloads, EventListener } from './types.js';

/**
 * Type-safe event bus for inter-module communication.
 * Uses a Map of Sets for O(1) average subscribe/unsubscribe operations.
 */
class EventBusImpl {
	/** Map of event names to their listener sets */
	private readonly listeners = new Map<EventName, Set<EventListener<EventName>>>();

	/**
	 * Subscribe to an event.
	 * @param event - The event name to subscribe to
	 * @param listener - The callback function to invoke when the event fires
	 * @returns An unsubscribe function for cleanup
	 */
	public on<T extends EventName>(event: T, listener: EventListener<T>): () => void {
		let eventListeners = this.listeners.get(event);

		if (eventListeners === undefined) {
			eventListeners = new Set();
			this.listeners.set(event, eventListeners);
		}

		// Cast is safe because we're adding to the correct event's listener set
		eventListeners.add(listener as EventListener<EventName>);

		// Return unsubscribe function
		return () => {
			this.off(event, listener);
		};
	}

	/**
	 * Subscribe to an event for a single invocation.
	 * @param event - The event name to subscribe to
	 * @param listener - The callback function to invoke once
	 * @returns An unsubscribe function for cleanup
	 */
	public once<T extends EventName>(event: T, listener: EventListener<T>): () => void {
		const wrapper: EventListener<T> = payload => {
			this.off(event, wrapper);
			listener(payload);
		};

		return this.on(event, wrapper);
	}

	/**
	 * Unsubscribe from an event.
	 * @param event - The event name to unsubscribe from
	 * @param listener - The callback function to remove
	 */
	public off<T extends EventName>(event: T, listener: EventListener<T>): void {
		const eventListeners = this.listeners.get(event);

		if (eventListeners !== undefined) {
			eventListeners.delete(listener as EventListener<EventName>);

			// Clean up empty sets to prevent memory leaks
			if (eventListeners.size === 0) {
				this.listeners.delete(event);
			}
		}
	}

	/**
	 * Emit an event to all subscribers.
	 * @param event - The event name to emit
	 * @param payload - The data to pass to listeners
	 */
	public emit<T extends EventName>(event: T, payload: EventPayloads[T]): void {
		const eventListeners = this.listeners.get(event);

		if (eventListeners !== undefined) {
			// Create a copy to avoid issues if listeners modify the set
			for (const listener of [...eventListeners]) {
				try {
					(listener as EventListener<T>)(payload);
				} catch (error) {
					console.error(`Error in event listener for "${event}":`, error);
				}
			}
		}
	}

	/**
	 * Remove all listeners for a specific event.
	 * @param event - The event name to clear
	 */
	public clear(event: EventName): void {
		this.listeners.delete(event);
	}

	/**
	 * Remove all listeners for all events.
	 */
	public clearAll(): void {
		this.listeners.clear();
	}

	/**
	 * Get the number of listeners for an event.
	 * @param event - The event name to check
	 * @returns The number of listeners
	 */
	public listenerCount(event: EventName): number {
		return this.listeners.get(event)?.size ?? 0;
	}

	/**
	 * Check if an event has any listeners.
	 * @param event - The event name to check
	 * @returns True if there are listeners
	 */
	public hasListeners(event: EventName): boolean {
		return this.listenerCount(event) > 0;
	}
}

/**
 * Singleton instance of the EventBus.
 * Import this to subscribe to or emit events from any module.
 */
export const eventBus = new EventBusImpl();

/**
 * Export the class for testing purposes.
 */
export { EventBusImpl };

