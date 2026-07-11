/**
 * Test helpers for the primitives.
 *
 * Components that take a `children` snippet can't be handed a plain string from a test, so this
 * wraps text into the smallest possible snippet.
 */

import { createRawSnippet } from 'svelte';

/** A `children` snippet that renders nothing but the given text. */
export function text(content: string) {
	return createRawSnippet(() => ({ render: () => `<span>${content}</span>` }));
}
