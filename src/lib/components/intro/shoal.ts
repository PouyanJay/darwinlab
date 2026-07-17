/**
 * The intro's shoal — a real flocking school of prey and one cruising shark, filling the welcome
 * screen's right half. Decoration with honest physics: the same three boid rules the lab's science
 * is about (separation, cohesion, alignment) plus flash expansion around the hunter, so the title
 * page shows the product's subject before a word is read.
 *
 * Pure canvas, no Svelte — the component mounts it and gets back a stop(). The canvas is
 * TRANSPARENT (the page's own ground shows through), so trails are drawn as fading polylines per
 * swimmer rather than by veiling the frame, and the same code works over both themes' backgrounds.
 * Under reduced motion the sim is settled off-screen and drawn ONCE: a parked school, no loop.
 */

interface Swimmer {
	x: number;
	y: number;
	vx: number;
	vy: number;
	trail: { x: number; y: number }[];
	/** Which drifting attractor this fish leans toward (the shark ignores them). */
	k?: number;
}

export interface ShoalColors {
	fish: string;
	pred: string;
}

const TRAIL = 9; // points per swimmer — short comet tails, sampled every other frame
const MARGIN = 56; // spawn inset + attractor amplitude — NOT a wall; the water wraps at the edges

export function startShoal(
	canvas: HTMLCanvasElement,
	colors: () => ShoalColors,
	reducedMotion: boolean
): () => void {
	const context = canvas.getContext('2d');
	if (!context) return () => {};
	const ctx: CanvasRenderingContext2D = context; // narrowed once, non-null in every closure below

	let W = 0;
	let H = 0;
	const fish: Swimmer[] = [];
	const shark: Swimmer = { x: 0, y: 0, vx: 1, vy: -0.4, trail: [] };
	let wander = Math.random() * Math.PI * 2;
	let frame = 0;
	let raf = 0;

	/**
	 * Three slow drifting attractors, each tracing its own loop across the water. Each fish leans
	 * weakly toward its own; without them the flock condenses into one huddle and leaves most of
	 * the canvas empty — with them, sub-shoals occupy and roam the WHOLE half, and the shark has
	 * distinct groups to hunt between.
	 */
	const drifts = [
		{ px: 0.9, py: 1.3, ox: 0 },
		{ px: 1.4, py: 0.7, ox: 2.1 },
		{ px: 0.6, py: 1.0, ox: 4.2 }
	];
	function attractor(k: number, t: number) {
		const d = drifts[k];
		return {
			x: W / 2 + Math.sin(t * 0.00006 * d.px + d.ox) * (W / 2 - MARGIN - 30),
			y: H / 2 + Math.cos(t * 0.00006 * d.py + d.ox * 1.7) * (H / 2 - MARGIN - 30)
		};
	}

	/** Size the backing store to the element (DPR-aware) and (re)seed to fit the new area. */
	function fit() {
		const rect = canvas.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		W = rect.width;
		H = rect.height;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		// the population scales with the water: a phone-sized panel gets a small school, a big
		// monitor's right half a proper one
		const want = Math.max(28, Math.min(90, Math.round((W * H) / 9_500)));
		while (fish.length < want) {
			fish.push({
				x: MARGIN + Math.random() * (W - 2 * MARGIN),
				y: MARGIN + Math.random() * (H - 2 * MARGIN),
				vx: (Math.random() - 0.5) * 2,
				vy: (Math.random() - 0.5) * 2,
				trail: [],
				k: fish.length % drifts.length
			});
		}
		fish.length = want;
		if (shark.x === 0 && shark.y === 0) {
			shark.x = W * 0.2;
			shark.y = H * 0.75;
		}
	}

	function step() {
		// the shark cruises: a slow wander plus a gentle pull toward the shoal's centre
		wander += (Math.random() - 0.5) * 0.25;
		let cx = 0;
		let cy = 0;
		for (const f of fish) {
			cx += f.x;
			cy += f.y;
		}
		cx /= fish.length;
		cy /= fish.length;
		shark.vx += Math.cos(wander) * 0.05 + (cx - shark.x) * 0.00045;
		shark.vy += Math.sin(wander) * 0.05 + (cy - shark.y) * 0.00045;
		const sv = Math.hypot(shark.vx, shark.vy) || 1;
		if (sv > 1.45) {
			shark.vx = (shark.vx / sv) * 1.45;
			shark.vy = (shark.vy / sv) * 1.45;
		}
		shark.x += shark.vx;
		shark.y += shark.vy;
		// the hunter wraps — vanishing off one edge and returning on the other reads as patrol
		if (shark.x < -50) shark.x = W + 50;
		if (shark.x > W + 50) shark.x = -50;
		if (shark.y < -50) shark.y = H + 50;
		if (shark.y > H + 50) shark.y = -50;

		for (const f of fish) {
			let ax = 0;
			let ay = 0;
			let ncx = 0;
			let ncy = 0;
			let nvx = 0;
			let nvy = 0;
			let n = 0;
			for (const o of fish) {
				if (o === f) continue;
				const dx = o.x - f.x;
				const dy = o.y - f.y;
				const d2 = dx * dx + dy * dy;
				if (d2 < 3200) {
					ncx += o.x;
					ncy += o.y;
					nvx += o.vx;
					nvy += o.vy;
					n++;
				}
				if (d2 < 260 && d2 > 0.01) {
					ax -= (dx / d2) * 9; // separation
					ay -= (dy / d2) * 9;
				}
			}
			if (n) {
				ax += (ncx / n - f.x) * 0.0024; // cohesion — loose, so the shoal breathes across the water
				ay += (ncy / n - f.y) * 0.0024;
				ax += (nvx / n - f.vx) * 0.055; // alignment
				ay += (nvy / n - f.vy) * 0.055;
			}
			// a weak lean toward this fish's own drifting attractor — coverage, not a leash
			const at = attractor(f.k ?? 0, frame * 16.7);
			ax += (at.x - f.x) * 0.0008;
			ay += (at.y - f.y) * 0.0008;
			// flash expansion: flee the shark, harder the closer it is
			const sdx = f.x - shark.x;
			const sdy = f.y - shark.y;
			const sd = Math.hypot(sdx, sdy);
			if (sd < 140 && sd > 0.01) {
				const p = (140 - sd) / 140;
				ax += (sdx / sd) * p * 0.85;
				ay += (sdy / sd) * p * 0.85;
			}
			f.vx += ax;
			f.vy += ay;
			const v = Math.hypot(f.vx, f.vy) || 1;
			if (v > 1.9) {
				f.vx = (f.vx / v) * 1.9;
				f.vy = (f.vy / v) * 1.9;
			}
			if (v < 0.7) {
				f.vx = (f.vx / v) * 0.7;
				f.vy = (f.vy / v) * 0.7;
			}
			f.x += f.vx;
			f.y += f.vy;
			// No walls: the water wraps. A fish that swims off one edge comes in from the opposite
			// side mid-stroke, still on its heading (the trail drawer skips the teleport segment).
			if (f.x < -20) f.x = W + 20;
			if (f.x > W + 20) f.x = -20;
			if (f.y < -20) f.y = H + 20;
			if (f.y > H + 20) f.y = -20;
		}

		// sample trails every other frame — twice the reach for half the points
		if (frame % 2 === 0) {
			for (const s of [...fish, shark]) {
				s.trail.unshift({ x: s.x, y: s.y });
				if (s.trail.length > TRAIL) s.trail.pop();
			}
		}
		frame++;
	}

	function body(s: Swimmer, len: number, girth: number) {
		ctx.save();
		ctx.translate(s.x, s.y);
		ctx.rotate(Math.atan2(s.vy, s.vx));
		ctx.beginPath();
		ctx.moveTo(len * 0.55, 0);
		ctx.quadraticCurveTo(0, -girth, -len * 0.45, 0);
		ctx.quadraticCurveTo(0, girth, len * 0.55, 0);
		ctx.closePath();
		ctx.fill();
		ctx.beginPath(); // tail
		ctx.moveTo(-len * 0.4, 0);
		ctx.lineTo(-len * 0.75, -girth * 0.8);
		ctx.lineTo(-len * 0.75, girth * 0.8);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	function trail(s: Swimmer, color: string, width: number) {
		if (s.trail.length < 2) return;
		ctx.strokeStyle = color;
		ctx.lineCap = 'round';
		for (let i = 0; i < s.trail.length - 1; i++) {
			const a = s.trail[i];
			const b = s.trail[i + 1];
			// wrap gap (the shark teleports across an edge): don't stroke across the whole canvas
			if (Math.hypot(b.x - a.x, b.y - a.y) > 60) break;
			ctx.globalAlpha = 0.22 * (1 - i / s.trail.length);
			ctx.lineWidth = width * (1 - i / (s.trail.length + 2));
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	function draw() {
		ctx.clearRect(0, 0, W, H);
		const { fish: fishColor, pred } = colors();
		for (const f of fish) trail(f, fishColor, 2.6);
		trail(shark, pred, 7);
		ctx.fillStyle = fishColor;
		for (const f of fish) body(f, 13, 3.4);
		ctx.fillStyle = pred;
		body(shark, 42, 9.5);
	}

	function loop() {
		step();
		draw();
		raf = requestAnimationFrame(loop);
	}

	const ro = new ResizeObserver(() => {
		fit();
		if (reducedMotion) {
			// settle the flock off-screen and park it — one honest frame, no motion
			for (let i = 0; i < 240; i++) step();
			for (const s of [...fish, shark]) s.trail = [];
			draw();
		}
	});
	ro.observe(canvas);
	fit();

	if (!reducedMotion) raf = requestAnimationFrame(loop);

	return () => {
		cancelAnimationFrame(raf);
		ro.disconnect();
	};
}
