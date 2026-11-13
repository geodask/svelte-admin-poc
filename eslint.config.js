import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	{
		ignores: [
			'**/node_modules/',
			'**/.svelte-kit/',
			'**/build/',
			'**/test-results/',
			'**/playwright-report/'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint recommends turning this off for TypeScript projects:
			// https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Links and navigation must go through `resolve()`, so they respect the base path.
		files: ['**/*.svelte', '**/*.ts', '**/*.js'],
		rules: {
			'svelte/no-navigation-without-resolve': 'error'
		}
	},
	{
		// The core's shared entry is browser-safe: it never imports `$app/server` (types aside,
		// which are erased) or the server-only modules behind `./server` and `./rest`.
		files: ['packages/core/src/**/*.ts'],
		ignores: [
			'packages/core/src/server.ts',
			'packages/core/src/rest.ts',
			'packages/core/src/**/*.test.ts',
			'packages/core/src/**/*.test-d.ts'
		],
		rules: {
			'@typescript-eslint/no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '$app/server',
							allowTypeImports: true,
							message: 'Only the server-only entry (src/server.ts) may import $app/server.'
						}
					],
					patterns: [
						{
							group: ['./server', './server.ts', './rest', './rest.ts'],
							message: 'Server-only modules must not reach the shared entry.'
						}
					]
				}
			]
		}
	}
);
