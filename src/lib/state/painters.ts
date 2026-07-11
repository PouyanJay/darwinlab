/**
 * Painter registry — canvases register a repaint fn, the loop calls them once per frame.
 *
 * Deliberately NOT reactive: painting must not go through the reactivity graph, because the
 * world data it reads is intentionally unproxied (see bench.svelte.ts).
 */
export class PainterRegistry {
	#painters = new Set<() => void>();

	/** Register a painter; returns its unregister fn. */
	add(paint: () => void): () => void {
		this.#painters.add(paint);
		return () => {
			this.#painters.delete(paint);
		};
	}

	paintAll(): void {
		for (const paint of this.#painters) paint();
	}

	clear(): void {
		this.#painters.clear();
	}

	get size(): number {
		return this.#painters.size;
	}
}
