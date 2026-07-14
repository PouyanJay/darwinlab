/**
 * The assay's answer, drawn as a compass.
 *
 * One spoke per bearing the shark was dropped at, pointing where the shark was. The spoke is GREEN if
 * the fish turned towards escape and RED if it turned into the shark — that yes/no is the assay's
 * verdict (see engine/assay.ts for why it is a turn and not a flee error). Its LENGTH is how far the
 * fish turned in the moment it was asked, so a brain that reacts hard and correctly draws a big green
 * star, and a brain that dithers draws a small one whatever colour it is.
 *
 * Grey spokes are bearings that were NOT ASKED: dead astern there is nothing to decide, and dead
 * ahead a left turn and a right turn are equally right. Marking them as hits or misses would be
 * scoring a coin toss and calling it skill.
 *
 * A compass rather than a bar chart because the question is directional and the answer has a shape
 * you can read in one look: blind draws a scatter of red and green at random, and a bearing-sensing
 * brain draws a wheel that is green nearly all the way round.
 */

import { TAU } from '../engine';
import type { BearingConsensus } from '../engine';
import { THEMES, type ThemeName } from './theme';

/** Chance: the share of a population with no information that still turns the right way. */
const CHANCE = 0.5;

const rgba = (triplet: string, alpha: number) => `rgba(${triplet},${alpha})`;

/** The colour a bearing earns: how much of the population turned towards escape there. */
function shareColour(theme: ThemeName, share: number): string {
	const th = THEMES[theme];
	const mid = th.lensMid.split(',').map(Number);
	const end = (share >= CHANCE ? th.lensGood : th.lensBad).split(',').map(Number);
	const k = Math.min(1, Math.abs(share - CHANCE) / CHANCE);
	const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
	return `rgb(${mix(mid[0], end[0])},${mix(mid[1], end[1])},${mix(mid[2], end[2])})`;
}

export function drawAssay(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	bearings: BearingConsensus[],
	theme: ThemeName
): void {
	const th = THEMES[theme];
	ctx.clearRect(0, 0, W, H);
	if (!bearings.length) return;

	const cx = W / 2;
	const cy = H / 2;
	const radius = Math.min(W, H) / 2 - 12; // room for the nose marker

	// the rim: every brain turned the right way here
	ctx.strokeStyle = rgba(th.lensIdle, 0.35);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, TAU);
	ctx.stroke();

	// the chance ring: half of them did, which is what no information looks like
	ctx.strokeStyle = rgba(th.lensMid, 0.6);
	ctx.setLineDash([3, 3]);
	ctx.beginPath();
	ctx.arc(cx, cy, radius * CHANCE, 0, TAU);
	ctx.stroke();
	ctx.setLineDash([]);

	// which way the fish was facing — every bearing is read off this nose
	ctx.fillStyle = th.inkSoft;
	ctx.beginPath();
	ctx.moveTo(cx + radius + 9, cy);
	ctx.lineTo(cx + radius + 2, cy - 3.5);
	ctx.lineTo(cx + radius + 2, cy + 3.5);
	ctx.closePath();
	ctx.fill();

	// One spoke per bearing, as long as the share of the population that turned towards escape there.
	// Past the dashed ring is better than chance; inside it is worse. A blind world's spokes hover on
	// the ring, all the way round; a bearing-sensing world's reach for the rim.
	const points: [number, number][] = [];
	for (const b of bearings) {
		const angle = (b.bearingDeg * TAU) / 360;

		if (b.share === null) {
			// Not asked: dead astern there is nothing to decide, dead ahead both turns are right.
			ctx.strokeStyle = rgba(th.lensIdle, 0.4);
			ctx.lineWidth = 1;
			ctx.setLineDash([2, 3]);
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
			ctx.stroke();
			ctx.setLineDash([]);
			continue;
		}

		const reach = radius * Math.max(0.06, b.share);
		const x = cx + Math.cos(angle) * reach;
		const y = cy + Math.sin(angle) * reach;
		points.push([x, y]);

		ctx.strokeStyle = shareColour(theme, b.share);
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(x, y);
		ctx.stroke();
	}

	// the shape the answers make together
	if (points.length > 2) {
		ctx.strokeStyle = rgba(th.lensIdle, 0.5);
		ctx.lineWidth = 1;
		ctx.beginPath();
		points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.closePath();
		ctx.stroke();
	}
}
