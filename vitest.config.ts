import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	test: {
		// Enable global test APIs (describe, it, expect, etc.)
		globals: true,

		// Use Node.js environment (no DOM needed for math/physics tests)
		environment: 'node',

		// Test file patterns
		include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
		exclude: ['node_modules', 'dist'],

		// Coverage configuration
		coverage: {
			provider: 'v8',
			enabled: false, // Enable with --coverage flag
			reporter: ['text', 'html', 'lcov'],
			reportsDirectory: './coverage',
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
				'src/**/index.ts',
				'src/main.ts',
			],
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 60,
				statements: 70,
			},
		},

		// Reporter configuration
		reporters: ['default'],

		// Timeout for tests
		testTimeout: 5000,
		hookTimeout: 10000,

		// Watch mode configuration
		watch: false,

		// Sequence configuration
		sequence: {
			shuffle: false,
			concurrent: true,
		},
	},

	// Resolve aliases matching vite.config.ts
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
			'@core': resolve(__dirname, './src/core'),
			'@config': resolve(__dirname, './src/config'),
			'@entities': resolve(__dirname, './src/entities'),
			'@math': resolve(__dirname, './src/math'),
			'@physics': resolve(__dirname, './src/physics'),
			'@rendering': resolve(__dirname, './src/rendering'),
			'@spatial': resolve(__dirname, './src/spatial'),
			'@systems': resolve(__dirname, './src/systems'),
			'@ui': resolve(__dirname, './src/ui'),
			'@utils': resolve(__dirname, './src/utils'),
		},
	},
});

