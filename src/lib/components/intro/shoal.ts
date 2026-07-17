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

// How long the scattered fish take to draw together into shoals. The school opens spread across the
// whole water and, while it gathers, the fish are mostly fleeing the shark — the coming-together is
// the slow thing you watch, not a fait accompli. Wall-clock, so it is ~3 minutes on any refresh rate.
const FORM_MS = 3 * 60 * 1000;

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
	let startMs = 0; // first-step timestamp — the clock the gather ramp is measured from

	/**
	 * The shark hunts the way the lab's real predator does — in phases, not a beeline:
	 * CRUISE (slow wander, deciding) → STALK (close on a chosen group, unhurried) → CIRCLE (hold a
	 * wary standoff ring around it, the caution) → STRIKE (one fast dart through the middle — the
	 * school flash-expands) → back to a long cruise. Deliberate, patient, occasionally violent.
	 */
	type HuntPhase = 'cruise' | 'stalk' | 'circle' | 'strike';
	const hunt: { phase: HuntPhase; k: number; timer: number } = {
		phase: 'cruise',
		k: 0,
		timer: 150
	};

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
		// The vertical range is pulled IN (×0.5): the flock's home is the middle of the half, not its
		// top or foot — it drifts around the centre rather than camping at an extreme. Horizontal
		// keeps most of its reach so the width stays used.
		return {
			x: W / 2 + Math.sin(t * 0.00006 * d.px + d.ox) * (W / 2 - MARGIN - 30) * 0.85,
			y: H / 2 + Math.cos(t * 0.00006 * d.py + d.ox * 1.7) * (H / 2 - MARGIN - 30) * 0.5
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
		const want = Math.max(42, Math.min(135, Math.round((W * H) / 6_333)));
		while (fish.length < want) {
			const k = fish.length % drifts.length;
			let x: number;
			let y: number;
			if (reducedMotion) {
				// One parked frame: seed already gathered at the group's home, so the still shows the
				// formed school it would have become rather than the scattered start.
				const home = attractor(k, 0);
				x = home.x + (Math.random() - 0.5) * 420;
				y = home.y + (Math.random() - 0.5) * 420;
			} else {
				// Scatter across the WHOLE water. The shoals are meant to gather slowly (see FORM_MS), so
				// the flock must not open already gathered — it starts spread out and fleeing.
				x = MARGIN + Math.random() * Math.max(1, W - 2 * MARGIN);
				y = MARGIN + Math.random() * Math.max(1, H - 2 * MARGIN);
			}
			fish.push({
				x,
				y,
				vx: (Math.random() - 0.5) * 2,
				vy: (Math.random() - 0.5) * 2,
				trail: [],
				k
			});
		}
		fish.length = want;
		if (shark.x === 0 && shark.y === 0) {
			shark.x = W * 0.2;
			shark.y = H * 0.75;
		}
	}

	function step() {
		// How far the flock has been allowed to gather. It opens at ~0 (scattered, cohesion and the
		// homeward lean switched off, so the fish only align, avoid each other and flee) and reaches 1
		// over FORM_MS, drawing the shoals together. Smoothstep, so the coming-together eases in rather
		// than starting at full pull. Reduced motion is settled instantly, so it gathers fully.
		if (startMs === 0) startMs = performance.now();
		const t = reducedMotion ? 1 : Math.min(1, (performance.now() - startMs) / FORM_MS);
		const gather = t * t * (3 - 2 * t);

		// per-group centroids: the shark hunts GROUPS, not the abstract average of everything
		const centroids = drifts.map(() => ({ x: 0, y: 0, n: 0 }));
		for (const f of fish) {
			const c = centroids[f.k ?? 0];
			c.x += f.x;
			c.y += f.y;
			c.n++;
		}
		for (const c of centroids) {
			if (c.n) {
				c.x /= c.n;
				c.y /= c.n;
			}
		}

		const target = centroids[hunt.k];
		const tdx = target.x - shark.x;
		const tdy = target.y - shark.y;
		const tdist = Math.hypot(tdx, tdy) || 1;
		hunt.timer--;

		let cap = 0.85; // cruising pace — the default, and the slowest
		if (hunt.phase === 'cruise') {
			wander += (Math.random() - 0.5) * 0.3;
			shark.vx += Math.cos(wander) * 0.04;
			shark.vy += Math.sin(wander) * 0.04;
			if (hunt.timer <= 0) {
				// done deciding: stalk the nearest group
				let best = 0;
				let bd = Infinity;
				centroids.forEach((c, i) => {
					if (!c.n) return;
					const d = Math.hypot(c.x - shark.x, c.y - shark.y);
					if (d < bd) {
						bd = d;
						best = i;
					}
				});
				hunt.k = best;
				hunt.phase = 'stalk';
			}
		} else if (hunt.phase === 'stalk') {
			cap = 1.05; // closing, but unhurried
			shark.vx += (tdx / tdist) * 0.035;
			shark.vy += (tdy / tdist) * 0.035;
			if (tdist < 250) {
				hunt.phase = 'circle';
				hunt.timer = 200 + Math.random() * 160; // 3–6 wary seconds on the ring
			}
		} else if (hunt.phase === 'circle') {
			cap = 1.15;
			// the caution: hold a standoff ring around the school and ride along it
			const ring = 185;
			const radial = (tdist - ring) / ring;
			shark.vx += (tdx / tdist) * radial * 0.09 + (-tdy / tdist) * 0.05;
			shark.vy += (tdy / tdist) * radial * 0.09 + (tdx / tdist) * 0.05;
			if (hunt.timer <= 0) {
				hunt.phase = 'strike';
				hunt.timer = 110;
			}
		} else {
			cap = 2.7; // the strike: one hard dart through the middle
			shark.vx += (tdx / tdist) * 0.32;
			shark.vy += (tdy / tdist) * 0.32;
			if (hunt.timer <= 0 || tdist < 26) {
				hunt.phase = 'cruise';
				hunt.timer = 260 + Math.random() * 300; // a long, slow retreat before the next hunt
			}
		}

		const sv = Math.hypot(shark.vx, shark.vy) || 1;
		if (sv > cap) {
			shark.vx = (shark.vx / sv) * cap;
			shark.vy = (shark.vy / sv) * cap;
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
				// Cohesion is gated by `gather`: off at the start (the flock stays scattered) and easing
				// up to its full, still-gentle pull as the minutes pass. Alignment is NOT gated — even a
				// scattered field should swim in coordinated streams, it just should not condense yet.
				ax += (ncx / n - f.x) * 0.0017 * gather;
				ay += (ncy / n - f.y) * 0.0017 * gather;
				ax += (nvx / n - f.vx) * 0.05; // alignment
				ay += (nvy / n - f.vy) * 0.05;
			}
			// The homeward lean is the real gathering force — also gated, so the groups only migrate to
			// their own patch of water once the school has begun to form.
			const at = attractor(f.k ?? 0, frame * 16.7);
			ax += (at.x - f.x) * 0.00055 * gather;
			ay += (at.y - f.y) * 0.00055 * gather;
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
