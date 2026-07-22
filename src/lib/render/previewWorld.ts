/**
 * Paint a still PREVIEW of a world at a config: a FRESH population (never evolved), stepped a couple of
 * sim-seconds so the fish scatter and the shark is hunting — the SETUP of a place, not its evolved
 * result. The three cards that peek at a world this way — the subject card, the Atlas drill and the
 * Sweep drill — all draw the same preview, so the recipe (and its constants) lives here once.
 */

import { makeWorld, stepWorld, seededRng, type WorldConfig } from '../engine';
import { drawWorld } from './drawWorld';
import type { ThemeName } from './theme';

const DT = 1 / 60;
/** One fixed seed, so a preview of the same config is the same picture every time. */
const PREVIEW_SEED = 7;
/** ~2 sim-seconds — long enough that the fish have scattered and the shark has begun to hunt. */
const SETTLE_STEPS = 120;

export function previewWorld(
	cfg: WorldConfig,
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	themeName: ThemeName
): void {
	const world = makeWorld(structuredClone(cfg), undefined, seededRng(PREVIEW_SEED));
	for (let i = 0; i < SETTLE_STEPS; i++) stepWorld(world, DT);
	drawWorld(world, ctx, width, height, { theme: themeName, detail: 'performance' });
}
