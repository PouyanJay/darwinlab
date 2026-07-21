/**
 * The lineage canvas VIEWPORT — one pan/zoom camera over the whole tree.
 *
 * Just an instance of the shared `Viewport` (see viewport.svelte.ts) with the tree's default scale
 * bounds. It is pure view state: how the camera sits over the tree, nothing about the worlds
 * themselves. Node positions live per-world on `entry.lineage` (views.svelte.ts).
 *
 * Kept out of the bench store on purpose — the bench is the seam that mutates the SIM, and moving
 * the camera touches no genome, fitness, or curve.
 */

import { Viewport } from './viewport.svelte';

export const canvas = new Viewport();
