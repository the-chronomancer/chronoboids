import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	// Root directory for the project
	root: '.',

	// Base public path
	base: './',

	// Resolve aliases for cleaner imports
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

	// Development server configuration
	server: {
		port: 3001,
		open: true,
		strictPort: false,
	},

	// Preview server configuration
	preview: {
		port: 4173,
		strictPort: true,
	},

	// Build configuration
	build: {
		// Output directory
		outDir: 'dist',

		// Generate sourcemaps for debugging
		sourcemap: true,

		// Target modern browsers
		target: 'es2022',

		// Minification
		minify: 'esbuild',

		// Rollup options
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'index.html'),
			},
			output: {
				// Chunk naming
				chunkFileNames: 'assets/[name]-[hash].js',
				entryFileNames: 'assets/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash].[ext]',
			},
		},

		// Chunk size warning limit
		chunkSizeWarningLimit: 1000,
	},

	// Optimize dependencies
	optimizeDeps: {
		include: ['pixi.js'],
	},

	// Enable esbuild for TypeScript
	esbuild: {
		target: 'es2022',
	},
});

