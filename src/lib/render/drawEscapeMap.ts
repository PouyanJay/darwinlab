/**
 * The escape map — an evolved policy painted as one readable picture.
 *
 * The Brain Inspector shows the WIRING; this shows the RULE. `probePolicy` (engine/probe.ts) has
 * already asked the brain "adversary here: what do you do?" at every bearing and distance; this
 * paints those answers on a polar disc so the strategy reads at a glance: "shark behind me → turn
 * hard and bolt; shark far → ignore it." The agent sits at the centre facing UP.
 *
 * ENCODING (the owner's call):
 *   • angle around the disc = the adversary's bearing (top = dead ahead, right = the agent's right)
 *   • radius = the adversary's distance (centre = on top of it, rim = the edge of vision)
 *   • HUE = which way the agent steers there — cool (excite) = turns left, warm (inhibit) = right
 *   • SATURATION = how decisively it steers (|turn|); a near-zero turn washes out to neutral grey
 *   • BRIGHTNESS = throttle (thrust) — a coasting cell is dark, a bolting one is bright
 * So a bright warm arc behind the fish reads "when the shark is behind me I turn right and run";
 * a uniformly dim grey disc reads "this fish ignores where the shark is" (see `map.flat`).
 *
 * Pure painter: engine data + theme name in, pixels out. No DOM beyond the passed context, no
 * simulation state. Colours come from the shared palette (`excite`/`inhibit`/`lensIdle`) so the
 * disc stays in step with the rest of the app in both themes.
 */

import { TAU } from '../engine';
import type { PolicyMap } from '../engine';
import { THEMES, type ThemeName } from './theme';

/** The live adversary, already resolved into the agent's own frame (what the disc is drawn in). */
export interface EscapeMarker {
	/** Bearing relative to the agent's heading, radians. 0 = dead ahead. */
	bearing: number;
	/** Distance as a fraction of vision, 0 (on the agent) … 1 (vision edge). */
	dist01: number;
}

export interface DrawEscapeMapOpts {
	/** The swept policy to paint. */
	map: PolicyMap;
	/** Where the real adversary is right now, or null when nothing is in the agent's vision. */
	marker: EscapeMarker | null;
	/** World clock — drives a gentle ping on the live marker. */
	t: number;
	theme: ThemeName;
	reducedMotion?: boolean;
}

type Rgb = [number, number, number];

/** "#rrggbb" → [r,g,b]. The palette stores the direction hues as hex; the disc mixes in rgb. */
function hexToRgb(hex: string): Rgb {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "r,g,b" (the palette's triplet form, e.g. lensIdle) → [r,g,b]. */
function tripletToRgb(t: string): Rgb {
	const [r, g, b] = t.split(',').map(Number);
	return [r, g, b];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Bearing (agent frame, 0 = ahead) → canvas angle. The disc is the world rotated so the agent's
 * heading points up: ahead → screen-up, the agent's right → screen-right. Canvas angles run from
 * +x with y downward, so that rotation is simply `bearing − π/2`.
 */
function canvasAngle(bearing: number): number {
	return bearing - Math.PI / 2;
}

export function drawEscapeMap(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	{ map, marker, t, theme, reducedMotion = false }: DrawEscapeMapOpts
): void {
	const th = THEMES[theme];
	ctx.clearRect(0, 0, W, H);

	const cx = W / 2;
	const cy = H / 2;
	const radius = Math.min(W, H) / 2 - 18; // room for the ahead/right/behind/left labels

	const LEFT = hexToRgb(th.excite); // cool — turns left  (turn < 0)
	const RIGHT = hexToRgb(th.inhibit); // warm — turns right (turn ≥ 0)
	const NEUTRAL = tripletToRgb(th.lensIdle); // no strong steer
	const bg: Rgb = theme === 'light' ? [247, 247, 242] : [18, 18, 25];

	// --- the cells: an annular sector per (bearing, distance) sample ---
	const { bearings, radii, samples } = map;
	for (let b = 0; b < bearings; b++) {
		// Sectors are centred on the sampled bearing (the sample sits at 2π·b/bearings).
		const a0 = canvasAngle((TAU * (b - 0.5)) / bearings);
		const a1 = canvasAngle((TAU * (b + 0.5)) / bearings);
		for (let r = 0; r < radii; r++) {
			const s = samples[b * radii + r];
			const hue = s.turn >= 0 ? RIGHT : LEFT;
			const strength = Math.min(1, Math.abs(s.turn)); // decisiveness → saturation
			const lum = 0.32 + 0.68 * s.thrust; // throttle → brightness
			const base = mix(NEUTRAL, hue, strength);
			const c: Rgb = [base[0] * lum, base[1] * lum, base[2] * lum];
			// Compose over the disc background so low-throttle cells settle toward the panel.
			const col = mix(bg, c, 0.9);
			ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
			const rin = (radius * r) / radii;
			const rout = (radius * (r + 1)) / radii;
			ctx.beginPath();
			ctx.arc(cx, cy, rout, a0, a1);
			ctx.arc(cx, cy, rin, a1, a0, true);
			ctx.closePath();
			ctx.fill();
		}
	}

	// --- distance rings + the outer vision edge ---
	ctx.strokeStyle = th.inkSoft;
	ctx.globalAlpha = 0.18;
	ctx.lineWidth = 1;
	for (let k = 1; k <= 3; k++) {
		ctx.beginPath();
		ctx.arc(cx, cy, (radius * k) / 3, 0, TAU);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;

	// --- the live adversary: where the real shark sits on this map, right now ---
	if (marker) {
		const R = radius * Math.max(0, Math.min(1, marker.dist01));
		const mx = cx + Math.sin(marker.bearing) * R;
		const my = cy - Math.cos(marker.bearing) * R;
		const ping = reducedMotion ? 0 : (Math.sin(t * 3) + 1) * 0.5; // gentle 0..1 breathe
		ctx.strokeStyle = th.threat;
		ctx.globalAlpha = 0.5 + 0.4 * (1 - ping);
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(mx, my, 6 + ping * 3, 0, TAU);
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.fillStyle = th.threat;
		ctx.beginPath();
		ctx.arc(mx, my, 3, 0, TAU);
		ctx.fill();
	}

	// --- the agent at the centre, a small glyph facing up ---
	ctx.fillStyle = theme === 'light' ? '#fff' : '#1a1a22';
	ctx.strokeStyle = th.ink;
	ctx.globalAlpha = 0.9;
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo(cx, cy - 7);
	ctx.lineTo(cx + 4.5, cy + 5);
	ctx.lineTo(cx - 4.5, cy + 5);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.globalAlpha = 1;

	// --- frame labels: the agent's own reference (top = ahead) ---
	ctx.fillStyle = th.inkSoft;
	ctx.globalAlpha = 0.72;
	ctx.font = '500 9px Inter, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('ahead', cx, cy - radius - 9);
	ctx.fillText('behind', cx, cy + radius + 10);
	ctx.textAlign = 'left';
	ctx.fillText('right', cx + radius + 4, cy);
	ctx.textAlign = 'right';
	ctx.fillText('left', cx - radius - 4, cy);
	ctx.globalAlpha = 1;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
}
