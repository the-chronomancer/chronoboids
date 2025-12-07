import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
// @ts-expect-error - No types available for eslint-config-prettier
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
	// Global ignores
	{
		ignores: ['dist/**', 'node_modules/**', 'lib/**', 'js/**', '*.min.js'],
	},

	// Base ESLint recommended rules
	eslint.configs.recommended,

	// TypeScript ESLint strict rules
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,

	// TypeScript files configuration
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.es2024,
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Strict type safety
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unsafe-assignment': 'error',
			'@typescript-eslint/no-unsafe-call': 'error',
			'@typescript-eslint/no-unsafe-member-access': 'error',
			'@typescript-eslint/no-unsafe-return': 'error',
			'@typescript-eslint/explicit-function-return-type': [
				'error',
				{
					allowExpressions: true,
					allowTypedFunctionExpressions: true,
				},
			],
			'@typescript-eslint/explicit-module-boundary-types': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],

			// Code quality
			'@typescript-eslint/prefer-readonly': 'error',
			'@typescript-eslint/prefer-nullish-coalescing': 'error',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'@typescript-eslint/no-unnecessary-condition': 'error',
			'@typescript-eslint/strict-boolean-expressions': 'error',

			// Performance-related
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/require-await': 'error',

			// General best practices
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			eqeqeq: ['error', 'always'],
			'prefer-const': 'error',
			'no-var': 'error',

			// Relaxed rules for specific patterns
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{ allowNumber: true }, // Numbers are safe in templates
			],
			'@typescript-eslint/no-extraneous-class': 'off', // Allow static utility classes
			'@typescript-eslint/no-non-null-assertion': 'warn', // Warn but don't error
			'@typescript-eslint/consistent-generic-constructors': 'warn',
			'@typescript-eslint/no-inferrable-types': 'warn',
		},
	},

	// Config files (less strict)
	{
		files: ['*.config.ts', '*.config.js'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
		},
	},

	// Test files (relaxed rules - test code is not production code)
	{
		files: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off', // Common in tests
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
		},
	},

	// Prettier compatibility (must be last)
	eslintConfigPrettier
);

