/**
 * The tank renderer. Faithful port of engine2.js: water, god-rays, particulate, the
 * perception overlay for the selected fish, the shark, the fish, and catch bursts.
 *
 * Pure painter: reads engine state, writes pixels. Owns no physics and mutates no simulation
 * state — except `w.transform`, the fit-scale mapping it computes so pointer picking
 * (see pick.ts) can invert it.
 */

import { TAU, fleeError, isSchoolingWorld, SOCIAL_RADIUS } from '../engine';
import type { World, Fish, Predator } from '../engine';
import { THEMES, type ThemeName, type ThemePalette, type DrawWorldOpts } from './theme';

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
): void {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/**
 * The static scene gradients, cached per canvas. Creating a CanvasGradient allocates and is
 * measurably slow, and five of the six only change when the theme, the tank dimensions or the
 * canvas itself do — not per frame. Keyed by everything they are built from; any change in the
 * key rebuilds the whole set. (The god-rays stay per-frame: their positions are animated.)
 */
interface SceneGradients {
	// the values the set was built from — compared field-wise so a cache hit allocates nothing
	theme: ThemeName;
	bw: number;
	bh: number;
	W: number;
	H: number;
	big: boolean;
	water: CanvasGradient;
	sheen: CanvasGradient;
	innerVignette: CanvasGradient;
	/** The magenta centre glow — dark theme only. */
	darkGlow: CanvasGradient | null;
	/** The soft radial backdrop behind a big (story) tank. */
	bigBackdrop: CanvasGradient | null;
	sharkBody: CanvasGradient;
}

const gradientCache = new WeakMap<CanvasRenderingContext2D, SceneGradients>();

function sceneGradients(
	ctx: CanvasRenderingContext2D,
	theme: ThemeName,
	th: ThemePalette,
	bw: number,
	bh: number,
	W: number,
	H: number,
	big: boolean
): SceneGradients {
	const cached = gradientCache.get(ctx);
	if (
		cached &&
		cached.theme === theme &&
		cached.bw === bw &&
		cached.bh === bh &&
		cached.W === W &&
		cached.H === H &&
		cached.big === big
	) {
		return cached;
	}

	const water = ctx.createLinearGradient(0, 0, 0, bh);
	if (theme === 'light') {
		// Deeper and a touch cooler than the reference's near-white wash, which went pale grey-green
		// the moment it sat on a warm page and read as a blank panel rather than as water. The floor
		// is darker than the surface now, so the tank has a top and a bottom.
		water.addColorStop(0, '#f6fcfa');
		water.addColorStop(0.45, '#e6f0ea');
		water.addColorStop(1, '#cddcd3');
	} else {
		water.addColorStop(0, '#0e0e15');
		water.addColorStop(1, '#030304');
	}

	const sheen = ctx.createLinearGradient(0, 0, 0, 30);
	if (theme === 'light') {
		sheen.addColorStop(0, 'rgba(255,255,252,.75)');
		sheen.addColorStop(1, 'rgba(255,255,252,0)');
	} else {
		// A neutral surface sheen — a faint top light on the water, no colour (monochrome dark).
		sheen.addColorStop(0, 'rgba(255,255,255,.05)');
		sheen.addColorStop(1, 'rgba(255,255,255,0)');
	}

	const innerVignette = ctx.createRadialGradient(
		bw / 2,
		bh / 2,
		Math.min(bw, bh) * 0.35,
		bw / 2,
		bh / 2,
		Math.max(bw, bh) * 0.72
	);
	if (theme === 'light') {
		innerVignette.addColorStop(0, 'rgba(30,50,40,0)');
		innerVignette.addColorStop(1, 'rgba(30,50,40,.1)'); // corners fall away — the water has depth
	} else {
		innerVignette.addColorStop(0, 'rgba(0,0,0,0)');
		innerVignette.addColorStop(1, 'rgba(0,0,0,.4)');
	}

	// The dark theme once had a magenta centre bloom here — pure vibe, gone with the monochrome re-skin.
	const darkGlow: CanvasGradient | null = null;

	let bigBackdrop: CanvasGradient | null = null;
	if (big) {
		bigBackdrop = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.62);
		if (theme === 'light') {
			bigBackdrop.addColorStop(0, 'rgba(244,250,246,.16)');
			bigBackdrop.addColorStop(1, 'rgba(244,250,246,0)');
		} else {
			// A neutral halo behind the cinematic stage — depth, not a coloured glow.
			bigBackdrop.addColorStop(0, 'rgba(235,238,245,.05)');
			bigBackdrop.addColorStop(1, 'rgba(235,238,245,0)');
		}
	}

	// drawn in the shark's local (translated/rotated) coordinates, so one gradient fits them all
	const sharkBody = ctx.createLinearGradient(0, -8, 0, 8);
	sharkBody.addColorStop(0, th.predDark);
	sharkBody.addColorStop(0.45, th.pred);
	sharkBody.addColorStop(1, th.pred);

	const built = {
		theme,
		bw,
		bh,
		W,
		H,
		big,
		water,
		sheen,
		innerVignette,
		darkGlow,
		bigBackdrop,
		sharkBody
	};
	gradientCache.set(ctx, built);
	return built;
}

/** Parse a `#rrggbb` accent into its rgb triplet, for composing rgba() glows at draw time. */
function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * THE SCHOOL DENSITY FIELD — the bait-ball, made legible.
 *
 * A live schooling population reads weakly frame-to-frame: twenty small fish are twenty small fish
 * whether they are packed or spread. So under them we lay a soft accent-tinted blob per fish; where
 * they crowd, the blobs overlap and the haze builds into a luminous mass, and where they scatter it
 * stays faint. It is a rendering of DENSITY and nothing else — no physics, no sim state touched — so
 * a tight Shoal glows and a loose Alone does not, which is exactly the comparison the exhibit is for.
 *
 * Painted only on worlds whose brains carry the shoal senses (declared, on or off — "Alone" is
 * declared-off and still shows a faint field, which is the point of the pairing).
 */
function drawSchoolField(
	w: World,
	ctx: CanvasRenderingContext2D,
	accent: string | undefined
): void {
	if (!accent || !isSchoolingWorld(w.cfg) || w.fish.length < 2) return;
	const [r, g, b] = hexToRgb(accent);
	// a touch under the sense radius, so it takes a real cluster (not two passing fish) to light up
	const R = (w.cfg.socialRadius ?? SOCIAL_RADIUS) * 0.6;
	const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
	glow.addColorStop(0, `rgba(${r},${g},${b},0.16)`);
	glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
	for (const f of w.fish) {
		ctx.save();
		ctx.translate(f.x, f.y);
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(0, 0, R, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
}

/** Per-frame render state for one creature — bundled so the painters don't take flag arguments. */
interface CreatureState {
	/** World clock, drives the tail-flick / sway animation. */
	t: number;
	selected: boolean;
	hovered: boolean;
	champion: boolean;
	reducedMotion: boolean;
	/** The lens's verdict on this fish, as a body colour. `null` = paint it in the palette's own. */
	tint?: string | null;
}

/** What aimless drift scores: a fish ignoring the shark averages a right angle to it. */
export const FLEE_CHANCE_DEG = 90;

const triplet = (rgb: string) => rgb.split(',').map(Number);

/**
 * The flee lens, as a colour — DIVERGING around chance (see ThemePalette.lensGood).
 *
 * 90° is the colour of a coin toss. Below it the fish is fleeing (toward `lensGood`), above it the
 * fish is swimming into the shark (toward `lensBad`), and `null` — no predator in vision, or too
 * slow to have a heading worth reading — is grey, because "not asked" is not the same as "correct".
 */
function fleeTint(th: ThemePalette, error: number | null): string {
	if (error === null) return `rgb(${th.lensIdle})`;

	const [mr, mg, mb] = triplet(th.lensMid);
	const away = error <= FLEE_CHANCE_DEG;
	const [er, eg, eb] = triplet(away ? th.lensGood : th.lensBad);

	// How far past chance, as a fraction of the half-scale either side of it.
	const k = Math.min(1, Math.abs(error - FLEE_CHANCE_DEG) / FLEE_CHANCE_DEG);
	const mix = (m: number, e: number) => Math.round(m + (e - m) * k);
	return `rgb(${mix(mr, er)},${mix(mg, eg)},${mix(mb, eb)})`;
}

function drawFish(
	ctx: CanvasRenderingContext2D,
	f: Fish,
	th: ThemePalette,
	{ t, selected: sel, hovered: hov, champion: champ, reducedMotion: rm, tint }: CreatureState
): void {
	// Under a lens the fish wears the lens's colour; otherwise it wears the palette's.
	const body = tint ?? th.fish;
	if (f.trail.length > 1) {
		ctx.strokeStyle = 'rgba(' + th.fishTrail + ',.2)';
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		f.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
		ctx.stroke();
	}
	ctx.fillStyle = th.shadow;
	ctx.beginPath();
	ctx.ellipse(f.x, f.y + 10, 6.5 * f.size, 2 * f.size, 0, 0, TAU);
	ctx.fill();
	const sp = Math.hypot(f.vx, f.vy);
	ctx.save();
	ctx.translate(f.x, f.y);
	ctx.rotate(f.heading);
	const s = f.size;
	const flick = rm ? 0 : Math.sin(t * (6 + sp * 0.07) + f.phase) * 0.55;
	// tail
	ctx.save();
	ctx.translate(-6.4 * s, 0);
	ctx.rotate(flick);
	ctx.beginPath();
	ctx.moveTo(1, 0);
	ctx.lineTo(-5.6 * s, -3.5 * s);
	ctx.lineTo(-5.6 * s, 3.5 * s);
	ctx.closePath();
	ctx.fillStyle = body;
	ctx.globalAlpha = 0.92;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.restore();
	// pelvic fin
	ctx.save();
	ctx.translate(1.2 * s, 1.8 * s);
	ctx.rotate(0.7 + flick * 0.4);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(-1.5 * s, 3.4 * s, -3.6 * s, 4 * s);
	ctx.quadraticCurveTo(-2 * s, 1.4 * s, -2 * s, 0);
	ctx.closePath();
	ctx.fillStyle = body;
	ctx.globalAlpha = 0.75;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.restore();
	// body + countershading + dorsal + eye
	ctx.beginPath();
	ctx.ellipse(0, 0, 7.6 * s, 3.1 * s, 0, 0, TAU);
	ctx.fillStyle = body;
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(0.6 * s, 1.15 * s, 5.4 * s, 1.6 * s, 0, 0, TAU);
	ctx.fillStyle = th.fishBelly;
	ctx.globalAlpha = 0.9;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.beginPath();
	ctx.moveTo(-1 * s, -2.6 * s);
	ctx.quadraticCurveTo(0.5 * s, -4.6 * s, 2.4 * s, -2.7 * s);
	ctx.closePath();
	ctx.fillStyle = body;
	ctx.fill();
	ctx.fillStyle = 'rgba(8,10,18,.9)';
	ctx.beginPath();
	ctx.arc(4.7 * s, -0.8 * s, 0.95 * s, 0, TAU);
	ctx.fill();
	ctx.restore();

	if (champ) {
		ctx.strokeStyle = th.gold;
		ctx.globalAlpha = 0.9;
		ctx.lineWidth = 1.8;
		ctx.beginPath();
		ctx.arc(f.x, f.y, 12.5, 0, TAU);
		ctx.stroke();
		ctx.fillStyle = th.gold;
		ctx.globalAlpha = 0.95;
		ctx.font = '700 9px Inter, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('★', f.x, f.y - 15);
		ctx.textAlign = 'left';
		ctx.globalAlpha = 1;
	}
	if (sel || hov) {
		const pulse = sel && !rm ? 1 + Math.sin(t * 4) * 0.12 : 1;
		ctx.strokeStyle = th.sel;
		ctx.globalAlpha = sel ? 0.95 : 0.4;
		ctx.lineWidth = sel ? 2 : 1.2;
		ctx.beginPath();
		ctx.arc(f.x, f.y, 15 * pulse, 0, TAU);
		ctx.stroke();
		if (sel) {
			ctx.globalAlpha = 0.18;
			ctx.beginPath();
			ctx.arc(f.x, f.y, 21 * pulse, 0, TAU);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}
}

function drawShark(
	ctx: CanvasRenderingContext2D,
	p: Predator,
	th: ThemePalette,
	{
		t,
		hovered: hov,
		reducedMotion: rm,
		body
	}: Pick<CreatureState, 't' | 'hovered' | 'reducedMotion'> & { body: CanvasGradient }
): void {
	if (p.trail.length > 1) {
		ctx.strokeStyle = 'rgba(' + th.burst + ',' + (p.lunge > 0 ? 0.4 : 0.18) + ')';
		ctx.lineWidth = p.lunge > 0 ? 3.5 : 2.5;
		ctx.beginPath();
		p.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
		ctx.stroke();
	}
	ctx.fillStyle = th.shadow;
	ctx.beginPath();
	ctx.ellipse(p.x, p.y + 14, 17, 4, 0, 0, TAU);
	ctx.fill();
	ctx.save();
	ctx.translate(p.x, p.y);
	ctx.rotate(p.heading);
	const L = p.lunge > 0 ? 1.1 : 1;
	const sway = rm ? 0 : Math.sin(t * 6.5) * (p.lunge > 0 ? 0.5 : 0.28);
	// heterocercal tail
	ctx.save();
	ctx.translate(-19, 0);
	ctx.rotate(sway);
	ctx.beginPath();
	ctx.moveTo(2, 0);
	ctx.quadraticCurveTo(-8, -3, -10.5, -12);
	ctx.quadraticCurveTo(-5.5, -6.5, -3, -2);
	ctx.quadraticCurveTo(-6, 2, -7, 7);
	ctx.quadraticCurveTo(-3.5, 3.5, 2, 1.5);
	ctx.closePath();
	ctx.fillStyle = th.pred;
	ctx.fill();
	ctx.restore();
	// body
	ctx.beginPath();
	ctx.moveTo(21 * L, 0);
	ctx.quadraticCurveTo(12, -7.8, -6, -5.4);
	ctx.quadraticCurveTo(-15, -3.6, -19.5, -0.8);
	ctx.quadraticCurveTo(-15, 3.6, -6, 5.4);
	ctx.quadraticCurveTo(12, 7.8, 21 * L, 0);
	ctx.fillStyle = body;
	ctx.fill();
	// belly, dorsal fin, pectoral fin, gills, eye
	ctx.beginPath();
	ctx.ellipse(3, 2.6, 11, 2.5, 0, 0, TAU);
	ctx.fillStyle = th.predBelly;
	ctx.globalAlpha = 0.75;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.beginPath();
	ctx.moveTo(-2.5, -4.8);
	ctx.quadraticCurveTo(1.5, -14, 6.5, -5.2);
	ctx.closePath();
	ctx.fillStyle = th.predDark;
	ctx.fill();
	ctx.save();
	ctx.translate(4, 3.4);
	ctx.rotate(0.6 + sway * 0.3);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(-2, 7, -7, 8.5);
	ctx.quadraticCurveTo(-4.5, 3, -4, 0);
	ctx.closePath();
	ctx.fillStyle = th.predDark;
	ctx.globalAlpha = 0.85;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.restore();
	ctx.strokeStyle = th.predDark;
	ctx.lineWidth = 0.9;
	ctx.globalAlpha = 0.8;
	for (let i = 0; i < 3; i++) {
		ctx.beginPath();
		ctx.arc(8.5 - i * 2.1, -0.4, 3.1, -1.1, 1.1);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.arc(14.5, -2.4, 1.7, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#14161f';
	ctx.beginPath();
	ctx.arc(14.9, -2.4, 1, 0, TAU);
	ctx.fill();
	ctx.restore();

	if (hov) {
		ctx.strokeStyle = th.threat;
		ctx.globalAlpha = 0.45;
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.arc(p.x, p.y, 27, 0, TAU);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}
}

/**
 * The perception overlay — the product's most distinctive teaching device: it draws the
 * invisible subject of the tool (what the selected fish senses) directly into the water.
 * Each element is gated by its sense, so switching a sense off removes it here too.
 */
function drawPerception(
	w: World,
	ctx: CanvasRenderingContext2D,
	th: ThemePalette,
	rm: boolean
): void {
	const f = w.selFish;
	if (!f) return;
	const c = w.cfg;
	const S = c.senses;
	let np: Predator | null = null;
	let nd = 1e9;
	for (const p of w.preds) {
		const d = Math.hypot(p.x - f.x, p.y - f.y);
		if (d < nd) {
			nd = d;
			np = p;
		}
	}
	if (S.dist) {
		const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, c.vision);
		g.addColorStop(0, 'rgba(' + th.selGlow + ',.08)');
		g.addColorStop(1, 'rgba(' + th.selGlow + ',0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(f.x, f.y, c.vision, 0, TAU);
		ctx.fill();
		ctx.setLineDash([4, 7]);
		ctx.strokeStyle = th.sel;
		ctx.globalAlpha = 0.38;
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.arc(f.x, f.y, c.vision, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.globalAlpha = 1;
	}
	if (np && S.dir) {
		const g = ctx.createLinearGradient(f.x, f.y, np.x, np.y);
		g.addColorStop(0, th.sel);
		g.addColorStop(1, th.threat);
		ctx.strokeStyle = g;
		ctx.globalAlpha = 0.75;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(f.x, f.y);
		ctx.lineTo(np.x, np.y);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}
	if (np && S.dist) {
		const mx = (f.x + np.x) / 2;
		const my = (f.y + np.y) / 2;
		const txt = Math.round(nd) + ' px';
		ctx.font = '600 11px Inter, sans-serif';
		const tw = ctx.measureText(txt).width;
		ctx.fillStyle = th.pill;
		roundRect(ctx, mx - tw / 2 - 6, my - 18, tw + 12, 16, 8);
		ctx.fill();
		ctx.strokeStyle = th.sel;
		ctx.globalAlpha = 0.3;
		ctx.lineWidth = 1;
		roundRect(ctx, mx - tw / 2 - 6, my - 18, tw + 12, 16, 8);
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.fillStyle = th.ink;
		ctx.textAlign = 'center';
		ctx.fillText(txt, mx, my - 6);
		ctx.textAlign = 'left';
	}
	if (np && S.closing && w.sense) {
		const k = rm ? 0.5 : (w.t * 1.5) % 1;
		const px = np.x + (f.x - np.x) * k;
		const py = np.y + (f.y - np.y) * k;
		ctx.fillStyle = th.threat;
		ctx.globalAlpha = 0.9;
		ctx.beginPath();
		ctx.arc(px, py, 2 + w.sense.nc * 3.5, 0, TAU);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	if (S.walls) {
		ctx.strokeStyle = th.sel;
		ctx.globalAlpha = 0.3;
		ctx.lineWidth = 1;
		for (const off of [-0.5, 0, 0.5]) {
			const a = f.heading + off;
			const cx = Math.cos(a);
			const cy = Math.sin(a);
			let t = 170;
			if (cx > 0) t = Math.min(t, (c.bw - f.x) / cx);
			if (cx < 0) t = Math.min(t, -f.x / cx);
			if (cy > 0) t = Math.min(t, (c.bh - f.y) / cy);
			if (cy < 0) t = Math.min(t, -f.y / cy);
			ctx.beginPath();
			ctx.moveTo(f.x, f.y);
			ctx.lineTo(f.x + cx * t, f.y + cy * t);
			ctx.stroke();
			if (t < 170) {
				ctx.globalAlpha = 0.55;
				ctx.beginPath();
				ctx.arc(f.x + cx * t, f.y + cy * t, 2.2, 0, TAU);
				ctx.fillStyle = th.sel;
				ctx.fill();
				ctx.globalAlpha = 0.3;
			}
		}
		ctx.globalAlpha = 1;
	}
}

export function drawWorld(
	w: World,
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	opts: DrawWorldOpts = {}
): void {
	const theme = opts.theme ?? 'light';
	const th = THEMES[theme];
	const rm = opts.reducedMotion ?? false;
	const c = w.cfg;
	const rich = !!opts.big || opts.detail !== 'performance';
	const grads = sceneGradients(ctx, theme, th, c.bw, c.bh, W, H, !!opts.big);
	ctx.clearRect(0, 0, W, H);

	// fit-scale transform (also consumed by pickCreature to invert pointer coords)
	const s = Math.min(W / c.bw, H / c.bh) * (opts.big ? 0.92 : 0.95);
	const ox = (W - c.bw * s) / 2;
	const oy = (H - c.bh * s) / 2;
	w.transform = { s, ox, oy };

	if (grads.bigBackdrop) {
		ctx.fillStyle = grads.bigBackdrop;
		ctx.fillRect(0, 0, W, H);
	}

	ctx.save();
	ctx.translate(ox, oy);
	ctx.scale(s, s);

	// water
	roundRect(ctx, 0, 0, c.bw, c.bh, 14);
	ctx.fillStyle = grads.water;
	ctx.fill();

	ctx.save();
	roundRect(ctx, 0, 0, c.bw, c.bh, 14);
	ctx.clip();

	// surface sheen
	ctx.fillStyle = grads.sheen;
	ctx.fillRect(0, 0, c.bw, 30);

	// god-rays (light, cinematic only) — dialled back from the reference's .38 for the same reason as
	// the dust: light in the water is set dressing, and it was reading as loudly as the creatures.
	if (theme === 'light' && rich && !rm) {
		ctx.globalAlpha = 0.28;
		for (let i = 0; i < 3; i++) {
			const rx = c.bw * (0.16 + i * 0.3) + Math.sin(w.t * 0.13 + i * 2.1) * c.bw * 0.06;
			const wd = c.bw * 0.1;
			const gr = ctx.createLinearGradient(rx, 0, rx + c.bw * 0.12, c.bh);
			gr.addColorStop(0, 'rgba(' + th.ray + ',.5)');
			gr.addColorStop(1, 'rgba(' + th.ray + ',0)');
			ctx.fillStyle = gr;
			ctx.beginPath();
			ctx.moveTo(rx - wd * 0.3, 0);
			ctx.lineTo(rx + wd, 0);
			ctx.lineTo(rx + wd * 2.4 + c.bw * 0.06, c.bh);
			ctx.lineTo(rx + wd * 0.5, c.bh);
			ctx.closePath();
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}
	if (grads.darkGlow) {
		ctx.fillStyle = grads.darkGlow;
		ctx.fillRect(0, 0, c.bw, c.bh);
	}

	// drifting particulate — frozen in place under reduced motion, like every other cosmetic
	if (rich) {
		ctx.fillStyle = th.dust;
		for (const d of w.dust) {
			const drift = rm ? 0 : w.t;
			const dy = (((d.y * c.bh + drift * d.s) % c.bh) + c.bh) % c.bh;
			const dx = d.x * c.bw + (rm ? 0 : Math.sin(w.t * 0.4 + d.p) * 6);
			// Quieter than the reference (.25 ± .15). The motes are atmosphere; at full strength they
			// twinkle hard enough to compete with the fish, which are the thing being watched.
			ctx.globalAlpha = 0.18 + (rm ? 0 : Math.sin(w.t * 0.8 + d.p) * 0.1);
			ctx.beginPath();
			ctx.arc(dx, dy, d.r, 0, TAU);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	// the school density field sits under everything alive — the water's mood, not a creature
	drawSchoolField(w, ctx, opts.accent);

	if (w.selFish) drawPerception(w, ctx, th, rm);
	for (const p of w.preds) {
		drawShark(ctx, p, th, {
			t: w.t,
			hovered: p === w.hover,
			reducedMotion: rm,
			body: grads.sharkBody
		});
	}
	const lens = opts.lens ?? 'none';
	for (const f of w.fish) {
		drawFish(ctx, f, th, {
			t: w.t,
			selected: f === w.selFish,
			hovered: f === w.hover,
			champion: f === w.championFish,
			reducedMotion: rm,
			// The lens asks the ENGINE for the reading (engine/flee.ts) — the same function the
			// evaluation panel's "flee error" is averaged from. One definition, two presentations.
			tint: lens === 'flee' ? fleeTint(th, fleeError(c, f, w.preds)) : null
		});
	}

	// catch bursts
	for (const b of w.bursts) {
		const k = b.a / 0.65;
		ctx.strokeStyle = 'rgba(' + th.burst + ',' + (1 - k) + ')';
		ctx.lineWidth = 2 * (1 - k) + 0.5;
		ctx.beginPath();
		ctx.arc(b.x, b.y, 4 + k * 26, 0, TAU);
		ctx.stroke();
		ctx.fillStyle = 'rgba(' + th.burst + ',' + (1 - k) * 0.75 + ')';
		for (let i = 0; i < 6; i++) {
			const ang = b.rot + (i / 6) * TAU;
			const r = 5 + k * 32;
			ctx.beginPath();
			ctx.arc(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r, 1.6 * (1 - k) + 0.3, 0, TAU);
			ctx.fill();
		}
	}

	// inner vignette
	ctx.fillStyle = grads.innerVignette;
	ctx.fillRect(0, 0, c.bw, c.bh);

	if (!w.fish.length) {
		ctx.fillStyle = theme === 'light' ? 'rgba(251,254,252,.55)' : 'rgba(4,4,6,.55)';
		ctx.fillRect(0, 0, c.bw, c.bh);
		ctx.fillStyle = th.ink;
		ctx.textAlign = 'center';
		ctx.font = '600 ' + Math.round(c.bw * 0.03) + 'px "Bricolage Grotesque", Inter, sans-serif';
		ctx.fillText('generation wiped out', c.bw / 2, c.bh / 2);
		ctx.textAlign = 'left';
	}
	ctx.restore();

	// tank edge
	ctx.strokeStyle = th.tankEdge;
	ctx.lineWidth = 2 / s;
	roundRect(ctx, 0, 0, c.bw, c.bh, 14);
	ctx.stroke();
	if (theme === 'light') {
		ctx.strokeStyle = 'rgba(255,255,255,.85)';
		ctx.lineWidth = 1.5 / s;
		ctx.beginPath();
		ctx.moveTo(16, 1.5 / s);
		ctx.lineTo(c.bw - 16, 1.5 / s);
		ctx.stroke();
	}
	ctx.restore();
}
