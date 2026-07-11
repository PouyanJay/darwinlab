import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
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
		// Engine purity (CLAUDE.md / ARCHITECTURE.md): the science layer must stay
		// framework- and DOM-free so it can run headlessly and stay portable. Forbid
		// importing Svelte / SvelteKit runtime modules from engine, render, and harness.
		files: ['src/lib/engine/**', 'src/lib/render/**', 'src/lib/harness/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{ name: 'svelte', message: 'Engine/render/harness must stay framework-agnostic.' },
						{ name: 'svelte/store', message: 'Engine/render/harness must stay framework-agnostic.' }
					],
					patterns: [
						{
							group: ['svelte/*', '@sveltejs/*', '$app/*', '$env/*', '$lib/state/*'],
							message: 'Engine/render/harness must stay framework-agnostic (no Svelte/Kit/state).'
						}
					]
				}
			]
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	}
);
