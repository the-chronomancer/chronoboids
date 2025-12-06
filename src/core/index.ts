/**
 * Core module exports.
 */

export { ChronoBoids } from './Application.js';
export { eventBus, EventBusImpl } from './EventBus.js';
export type {
	IVector2D,
	IReadonlyVector2D,
	SimulationConfig,
	MutableSimulationConfig,
	VisualSettings,
	PhysicsSettings,
	DebugSettings,
	BoidData,
	NeighborData,
	SpatialCell,
	SpatialHashConfig,
	RenderContext,
	BoidVisual,
	InputState,
	ExplosionState,
	RuntimeState,
	EventName,
	EventPayloads,
	EventListener,
	SettingsEncodingMap,
	SerializedSettings,
} from './types.js';

