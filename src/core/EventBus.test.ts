/**
 * Unit tests for EventBus class.
 */

import { describe, it, expect, vi } from 'vitest';
import { EventBusImpl } from './EventBus.js';

describe('EventBus', () => {
	// Create fresh bus for each test to avoid shared state
	function createBus(): EventBusImpl {
		return new EventBusImpl();
	}

	describe('on', () => {
		it('should subscribe to an event', () => {
			const bus = createBus();
			const listener = vi.fn();
			bus.on('simulation:start', listener);
			expect(bus.hasListeners('simulation:start')).toBe(true);
		});

		it('should return an unsubscribe function', () => {
			const bus = createBus();
			const listener = vi.fn();
			const unsubscribe = bus.on('simulation:start', listener);

			unsubscribe();
			expect(bus.hasListeners('simulation:start')).toBe(false);
		});

		it('should allow multiple listeners for same event', () => {
			const bus = createBus();
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			bus.on('simulation:start', listener1);
			bus.on('simulation:start', listener2);

			expect(bus.listenerCount('simulation:start')).toBe(2);
		});
	});

	describe('once', () => {
		it('should only fire once', () => {
			const bus = createBus();
			const listener = vi.fn();
			bus.once('simulation:start', listener);

			bus.emit('simulation:start', undefined);
			bus.emit('simulation:start', undefined);

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('should return an unsubscribe function', () => {
			const bus = createBus();
			const listener = vi.fn();
			const unsubscribe = bus.once('simulation:start', listener);

			unsubscribe();
			bus.emit('simulation:start', undefined);

			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe('off', () => {
		it('should unsubscribe a listener', () => {
			const bus = createBus();
			const listener = vi.fn();
			bus.on('simulation:start', listener);
			bus.off('simulation:start', listener);

			expect(bus.hasListeners('simulation:start')).toBe(false);
		});

		it('should only remove the specified listener', () => {
			const bus = createBus();
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			bus.on('simulation:start', listener1);
			bus.on('simulation:start', listener2);
			bus.off('simulation:start', listener1);

			expect(bus.listenerCount('simulation:start')).toBe(1);
		});

		it('should handle removing non-existent listener', () => {
			const bus = createBus();
			const listener = vi.fn();
			expect(() => {
				bus.off('simulation:start', listener);
			}).not.toThrow();
		});
	});

	describe('emit', () => {
		it('should call all listeners with payload', () => {
			const bus = createBus();
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			bus.on('simulation:resize', listener1);
			bus.on('simulation:resize', listener2);

			const payload = { width: 800, height: 600 };
			bus.emit('simulation:resize', payload);

			expect(listener1).toHaveBeenCalledWith(payload);
			expect(listener2).toHaveBeenCalledWith(payload);
		});

		it('should handle events with no listeners', () => {
			const bus = createBus();
			expect(() => {
				bus.emit('simulation:start', undefined);
			}).not.toThrow();
		});

		it('should catch and log listener errors', () => {
			const bus = createBus();
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
				// Mock implementation
			});
			const errorListener = vi.fn(() => {
				throw new Error('Test error');
			});
			const normalListener = vi.fn();

			bus.on('simulation:start', errorListener);
			bus.on('simulation:start', normalListener);

			bus.emit('simulation:start', undefined);

			expect(consoleError).toHaveBeenCalled();
			expect(normalListener).toHaveBeenCalled();

			consoleError.mockRestore();
		});
	});

	describe('clear', () => {
		it('should remove all listeners for an event', () => {
			const bus = createBus();
			bus.on('simulation:start', vi.fn());
			bus.on('simulation:start', vi.fn());
			bus.clear('simulation:start');

			expect(bus.hasListeners('simulation:start')).toBe(false);
		});

		it('should not affect other events', () => {
			const bus = createBus();
			bus.on('simulation:start', vi.fn());
			bus.on('simulation:stop', vi.fn());
			bus.clear('simulation:start');

			expect(bus.hasListeners('simulation:stop')).toBe(true);
		});
	});

	describe('clearAll', () => {
		it('should remove all listeners for all events', () => {
			const bus = createBus();
			bus.on('simulation:start', vi.fn());
			bus.on('simulation:stop', vi.fn());
			bus.on('simulation:reset', vi.fn());
			bus.clearAll();

			expect(bus.hasListeners('simulation:start')).toBe(false);
			expect(bus.hasListeners('simulation:stop')).toBe(false);
			expect(bus.hasListeners('simulation:reset')).toBe(false);
		});
	});

	describe('listenerCount', () => {
		it('should return correct count', () => {
			const bus = createBus();
			expect(bus.listenerCount('simulation:start')).toBe(0);

			bus.on('simulation:start', vi.fn());
			expect(bus.listenerCount('simulation:start')).toBe(1);

			bus.on('simulation:start', vi.fn());
			expect(bus.listenerCount('simulation:start')).toBe(2);
		});
	});

	describe('hasListeners', () => {
		it('should return false for no listeners', () => {
			const bus = createBus();
			expect(bus.hasListeners('simulation:start')).toBe(false);
		});

		it('should return true when listeners exist', () => {
			const bus = createBus();
			bus.on('simulation:start', vi.fn());
			expect(bus.hasListeners('simulation:start')).toBe(true);
		});
	});

	describe('type safety', () => {
		it('should enforce correct payload types', () => {
			const bus = createBus();
			bus.on('config:change', payload => {
				// TypeScript should infer payload type
				expect(payload.key).toBeDefined();
				expect(payload.value).toBeDefined();
			});

			bus.emit('config:change', { key: 'boids', value: 100 });
		});
	});
});

