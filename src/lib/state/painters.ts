/**
 * Painter registry — canvases register a repaint fn, the loop calls them once per frame.
 *
 * Deliberately NOT reactive: painting must not go through the reactivity graph, because the
 * world data it reads is intentionally unproxied (see bench.svelte.ts).
 *
 * Painters register under a GROUP so the loop can paint only what is on screen. While a story
 * plays, the bench behind it is frozen AND covered — repainting its fifteen hidden canvases
 * every frame would burn the budget the film needs. `'always'` is for surfaces that ride on top
 * of either context: the brain inspector works over the bench and over a scene alike.
 */
export type PaintGroup = 'bench' | 'story' | 'always';

export class PainterRegistry {
	#painters = new Map<() => void, PaintGroup>();

	/** Register a painter; returns its unregister fn. */
	add(paint: () => void, group: PaintGroup = 'bench'): () => void {
		this.#painters.set(paint, group);
		return () => {
			this.#painters.delete(paint);
		};
	}

	/** Repaint the `active` group, plus everything registered as 'always'. */
	paintAll(active: 'bench' | 'story' = 'bench'): void {
		for (const [paint, group] of this.#painters) {
			if (group === active || group === 'always') paint();
		}
	}

	clear(): void {
		this.#painters.clear();
	}

	get size(): number {
		return this.#painters.size;
	}
}
