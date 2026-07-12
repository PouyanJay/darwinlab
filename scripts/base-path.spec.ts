/**
 * Lock-in for the BASE_PATH guard. This validation runs at build time, so nothing else
 * automated would ever watch it fail — and a guard nobody has seen fail is not a guard.
 */

import { describe, it, expect } from 'vitest';
import { resolveBasePath } from './base-path';

describe('resolveBasePath', () => {
	it('passes a well-formed sub-path through', () => {
		expect(resolveBasePath({ BASE_PATH: '/darwinlab' })).toBe('/darwinlab');
	});

	it('defaults to the root base when BASE_PATH is unset or empty', () => {
		expect(resolveBasePath({})).toBe('');
		expect(resolveBasePath({ BASE_PATH: '' })).toBe('');
	});

	it('rejects a path with no leading slash', () => {
		expect(() => resolveBasePath({ BASE_PATH: 'darwinlab' })).toThrowError(/must start with "\/"/);
	});

	it('rejects a trailing slash — SvelteKit would die later with a far vaguer error', () => {
		expect(() => resolveBasePath({ BASE_PATH: '/darwinlab/' })).toThrowError(/must not end/);
	});

	it('always yields the root base under vitest, whatever BASE_PATH says', () => {
		// Both vitest projects extend the app's vite config; a base path 404s the browser
		// runner's own assets. VITEST wins over BASE_PATH so the suite cannot be broken
		// from the shell environment.
		expect(resolveBasePath({ VITEST: 'true', BASE_PATH: '/darwinlab' })).toBe('');
	});
});
