/**
 * The tank renderer. Faithful port of engine2.js: water, god-rays, particulate, the
 * perception overlay for the selected fish, the shark, the fish, and catch bursts.
 *
 * Pure painter: reads engine state, writes pixels. Owns no physics and mutates no simulation
 * state — except `w.transform`, the fit-scale mapping it computes so pointer picking
 * (see pick.ts) can invert it.
 */

import { TAU } from '../engine';
import type { World, Fish, Predator } from '../engine';
import { THEMES, type ThemePalette, type DrawWorldOpts } from './theme';

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

/** Per-frame render state for one creature — bundled so the painters don't take flag arguments. */
interface CreatureState {
	/** World clock, drives the tail-flick / sway animation. */
	t: number;
	selected: boolean;
	hovered: boolean;
	champion: boolean;
	reducedMotion: boolean;
}

function drawFish(
	ctx: CanvasRenderingContext2D,
	f: Fish,
	th: ThemePalette,
	{ t, selected: sel, hovered: hov, champion: champ, reducedMotion: rm }: CreatureState
): void {
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
	ctx.fillStyle = th.fish;
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
	ctx.fillStyle = th.fish;
	ctx.globalAlpha = 0.75;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.restore();
	// body + countershading + dorsal + eye
	ctx.beginPath();
	ctx.ellipse(0, 0, 7.6 * s, 3.1 * s, 0, 0, TAU);
	ctx.fillStyle = th.fish;
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
	ctx.fillStyle = th.fish;
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
	{ t, hovered: hov, reducedMotion: rm }: Pick<CreatureState, 't' | 'hovered' | 'reducedMotion'>
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
	const bg = ctx.createLinearGradient(0, -8, 0, 8);
	bg.addColorStop(0, th.predDark);
	bg.addColorStop(0.45, th.pred);
	bg.addColorStop(1, th.pred);
	ctx.beginPath();
	ctx.moveTo(21 * L, 0);
	ctx.quadraticCurveTo(12, -7.8, -6, -5.4);
	ctx.quadraticCurveTo(-15, -3.6, -19.5, -0.8);
	ctx.quadraticCurveTo(-15, 3.6, -6, 5.4);
	ctx.quadraticCurveTo(12, 7.8, 21 * L, 0);
	ctx.fillStyle = bg;
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
	ctx.clearRect(0, 0, W, H);

	// fit-scale transform (also consumed by pickCreature to invert pointer coords)
	const s = Math.min(W / c.bw, H / c.bh) * (opts.big ? 0.92 : 0.95);
	const ox = (W - c.bw * s) / 2;
	const oy = (H - c.bh * s) / 2;
	w.transform = { s, ox, oy };

	if (opts.big) {
		const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.62);
		if (theme === 'light') {
			g.addColorStop(0, 'rgba(244,250,246,.16)');
			g.addColorStop(1, 'rgba(244,250,246,0)');
		} else {
			g.addColorStop(0, 'rgba(255,45,156,.06)');
			g.addColorStop(1, 'rgba(255,45,156,0)');
		}
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);
	}

	ctx.save();
	ctx.translate(ox, oy);
	ctx.scale(s, s);

	// water
	const g = ctx.createLinearGradient(0, 0, 0, c.bh);
	if (theme === 'light') {
		g.addColorStop(0, '#fbfefc');
		g.addColorStop(0.45, '#eef3ea');
		g.addColorStop(1, '#dce4d6');
	} else {
		g.addColorStop(0, '#0e0e15');
		g.addColorStop(1, '#030304');
	}
	roundRect(ctx, 0, 0, c.bw, c.bh, 14);
	ctx.fillStyle = g;
	ctx.fill();

	ctx.save();
	roundRect(ctx, 0, 0, c.bw, c.bh, 14);
	ctx.clip();

	// surface sheen
	const sg = ctx.createLinearGradient(0, 0, 0, 30);
	if (theme === 'light') {
		sg.addColorStop(0, 'rgba(255,255,252,.75)');
		sg.addColorStop(1, 'rgba(255,255,252,0)');
	} else {
		sg.addColorStop(0, 'rgba(255,45,156,.07)');
		sg.addColorStop(1, 'rgba(255,45,156,0)');
	}
	ctx.fillStyle = sg;
	ctx.fillRect(0, 0, c.bw, 30);

	// god-rays (light, cinematic only)
	if (theme === 'light' && rich && !rm) {
		ctx.globalAlpha = 0.38;
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
	if (theme === 'dark') {
		const vg = ctx.createRadialGradient(
			c.bw / 2,
			c.bh / 2,
			c.bh * 0.2,
			c.bw / 2,
			c.bh / 2,
			c.bw * 0.7
		);
		vg.addColorStop(0, 'rgba(255,45,156,.05)');
		vg.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = vg;
		ctx.fillRect(0, 0, c.bw, c.bh);
	}

	// drifting particulate
	if (rich) {
		ctx.fillStyle = th.dust;
		for (const d of w.dust) {
			const dy = (((d.y * c.bh + w.t * d.s) % c.bh) + c.bh) % c.bh;
			const dx = d.x * c.bw + Math.sin(w.t * 0.4 + d.p) * 6;
			ctx.globalAlpha = 0.25 + Math.sin(w.t * 0.8 + d.p) * 0.15;
			ctx.beginPath();
			ctx.arc(dx, dy, d.r, 0, TAU);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	if (w.selFish) drawPerception(w, ctx, th, rm);
	for (const p of w.preds) {
		drawShark(ctx, p, th, { t: w.t, hovered: p === w.hover, reducedMotion: rm });
	}
	for (const f of w.fish) {
		drawFish(ctx, f, th, {
			t: w.t,
			selected: f === w.selFish,
			hovered: f === w.hover,
			champion: f === w.championFish,
			reducedMotion: rm
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
	const iv = ctx.createRadialGradient(
		c.bw / 2,
		c.bh / 2,
		Math.min(c.bw, c.bh) * 0.35,
		c.bw / 2,
		c.bh / 2,
		Math.max(c.bw, c.bh) * 0.72
	);
	if (theme === 'light') {
		iv.addColorStop(0, 'rgba(30,50,40,0)');
		iv.addColorStop(1, 'rgba(30,50,40,.06)');
	} else {
		iv.addColorStop(0, 'rgba(0,0,0,0)');
		iv.addColorStop(1, 'rgba(0,0,0,.4)');
	}
	ctx.fillStyle = iv;
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
