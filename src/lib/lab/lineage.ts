/**
 * The lineage canvas geometry — the pure numbers and path maths behind the family tree.
 *
 * Worlds are nodes on an infinite, pannable, zoomable plane. A node's position is its top-left in
 * CANVAS coordinates (see LineageView); the viewport store maps canvas → screen. This module holds
 * the sizes the store and the canvas component must agree on, plus the curve that wires a parent to
 * a child. No Svelte, no DOM — just geometry.
 */

/** A world node's fixed width in canvas units. Height is natural (the node is as tall as it needs). */
export const NODE_W = 468;
/** Horizontal gap between root siblings when the bench first lays them out in a row. */
export const NODE_GAP_X = 84;
/** How far below a parent a freshly branched child drops — clear of a compact node (~650px tall),
 *  so the wire between them has room and reads as "descends from" rather than overlapping it. */
export const BRANCH_DROP = 720;
/** Sideways offset per additional child, so siblings fan out instead of stacking on one line. */
export const NODE_STAGGER_X = 264;

/** Zoom bounds — far enough out to see a big tree, close enough in to read a single tank. */
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 1.6;

export function clampScale(s: number): number {
	return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/**
 * A smooth vertical S-curve from a parent's lower edge to a child's upper edge, in whatever space
 * the caller hands in (screen or canvas — the maths is the same). The control points pull straight
 * down out of the parent and straight up into the child, so the wire reads as "descends from" even
 * when the child is dragged off to the side.
 */
export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
	const dy = Math.max(36, Math.abs(y2 - y1) * 0.5);
	return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
}
