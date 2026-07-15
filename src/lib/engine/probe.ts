/**
 * Policy probe — turns an evolved brain into a readable picture of the rule it learned.
 *
 * The Brain Inspector shows the WIRING (dots and lines); this shows the POLICY. We hold the
 * agent still and ask its brain the same question at every point around it — "adversary here:
 * what do you do?" — by placing a synthetic adversary at each bearing/distance and reading the
 * motor output back. Swept over a polar grid, the answers ARE the strategy: "when it's behind
 * me, turn hard; when it's far, ignore it."
 *
 * HONEST BY CONSTRUCTION. This module invents no sensing of its own — it calls the exact
 * `senseInputs` + `forward` the simulation runs every tick (see `updateSenseSnapshot`), so the
 * map can only ever show what the fish actually perceives. `samplePolicyAt` is the single seam
 * where that happens; `probePolicy` is that seam swept over a grid. A test pins the seam to the
 * sim's own snapshot bit-for-bit, so the probe can never quietly drift into a private encoding.
 *
 * WHAT THE MAP HOLDS FIXED (the slice, stated plainly so the UI can too): the brain has up to
 * nine inputs and this picture varies only TWO of them — the adversary's bearing and distance.
 * The agent is at rest and centred, so wall pressure reads its far, uniform value; the adversary
 * approaches at cruise, so the closing rate is the same everywhere. A fish whose only sense is
 * closing or walls therefore reads FLAT here — truthfully: moving the adversary around it changes
 * nothing it can feel. The map is the position rule, not the whole mind. No DOM, no Svelte.
 */

import { senseInputs } from './sensing';
import { forward } from './network';
import type { WorldConfig, Fish, Predator, Genome } from './types';

/** Default angular resolution — samples around the full turn. */
export const PROBE_BEARINGS = 48;
/** Default radial resolution — samples from the agent out to its vision edge. */
export const PROBE_RADII = 16;
/** Below this spread in every output, the policy doesn't depend on adversary position → flat. */
const FLAT_EPS = 1e-9;
/**
 * The adversary's cruise speed at `predSpeed = 1`, px/s — the honest "bearing down at cruise" pose.
 * Mirrors the cruise cap in world.ts (`200 * ps * frust`); kept in step BY HAND because the project
 * deliberately keeps predator-internal constants inline at their world.ts call sites, verbatim (see
 * constants.ts). If that cruise cap is ever retuned, this must move with it.
 */
const ADVERSARY_CRUISE = 200;

/** One cell: the motor response the brain gives to an adversary at a given bearing/distance. */
export interface PolicySample {
	/** Steering, tanh output ∈ [−1, 1] (sign = which way it turns). */
	turn: number;
	/** Throttle, sigmoid output ∈ [0, 1] (0 = coast, 1 = bolt). */
	thrust: number;
}

/** A swept policy: the readable escape map, plus the numbers the painter needs to scale it. */
export interface PolicyMap {
	/** Angular sample count. */
	bearings: number;
	/** Radial sample count. */
	radii: number;
	/** Outer radius the map spans, logical px (the agent's vision). */
	vision: number;
	/**
	 * Row-major, length `bearings * radii`, indexed `[b * radii + r]`. Bearing `b` is measured
	 * from the agent's forward direction (b=0 dead ahead) and steps a full turn; radius `r`
	 * steps from just off the agent out to the vision edge (cell centres, so none sit on the
	 * agent or exactly on the vision line where perception cuts to zero).
	 */
	samples: PolicySample[];
	/**
	 * True when the response is the same in every cell — the agent ignores where the adversary
	 * is. A blind agent (no position sense), OR one that HAS the sense but evolved weights near
	 * zero on it, OR one whose only senses are the ones this slice holds fixed. All three are
	 * real findings the UI can name; the flag is measured, not inferred from the sense config.
	 */
	flat: boolean;
	/** Output spread across the grid, so a painter can normalise and a caller can gauge flatness. */
	turnRange: [min: number, max: number];
	thrustRange: [min: number, max: number];
}

export interface ProbeOptions {
	bearings?: number;
	radii?: number;
}

/**
 * THE SEAM. Places `adversary` as the sole predator and reads the agent's motor response through
 * the simulation's own sensing + forward pass — nothing else. `updateSenseSnapshot` does exactly
 * this for the live fish; a test asserts the two agree bit-for-bit.
 */
export function samplePolicyAt(cfg: WorldConfig, agent: Fish, adversary: Predator): PolicySample {
	const { x } = senseInputs({ cfg, preds: [adversary] }, agent);
	const out = forward(agent.genome, x);
	return { turn: out.turn, thrust: out.thrust };
}

/**
 * The canonical agent for the slice: this genome's brain, in a body held still and centred so
 * the only things that vary across the map are the adversary's bearing and distance. Heading is
 * forward-along-x; the map is built in the agent's own frame (bearings are relative to heading),
 * so the value is arbitrary and the painter decides which way "forward" points on screen.
 */
function canonicalAgent(cfg: WorldConfig, genome: Genome): Fish {
	return {
		x: cfg.bw / 2,
		y: cfg.bh / 2,
		vx: 0,
		vy: 0,
		heading: 0,
		trail: [],
		phase: 0,
		size: 1,
		genome,
		fitness: 0,
		turn: 0,
		thrust: 0,
		trailT: 0
	};
}

/**
 * A synthetic adversary at `(bearing, distance)` from the agent, closing at cruise. Its velocity
 * points straight at the agent at `200 · predSpeed` (world.ts), so the closing-rate input reads
 * the same honest "bearing down at cruise" value everywhere on the map.
 */
function adversaryAt(cfg: WorldConfig, agent: Fish, bearing: number, distance: number): Predator {
	const ang = agent.heading + bearing;
	const px = agent.x + Math.cos(ang) * distance;
	const py = agent.y + Math.sin(ang) * distance;
	const cruise = ADVERSARY_CRUISE * cfg.predSpeed;
	const ux = (agent.x - px) / (distance || 1);
	const uy = (agent.y - py) / (distance || 1);
	return {
		x: px,
		y: py,
		vx: ux * cruise,
		vy: uy * cruise,
		heading: Math.atan2(uy, ux),
		lunge: 0,
		cool: 0,
		aim: 0,
		trail: [],
		trailT: 0
	};
}

/**
 * Sweep a brain's policy over a polar grid of adversary positions — the escape map.
 *
 * Takes a genome rather than a live fish on purpose: the map is a property of the evolved brain,
 * not of wherever the selected fish happens to be swimming this frame. ~`bearings · radii`
 * forward passes (768 at defaults) — cheap, but meant to run on selection / generation change,
 * never per frame.
 */
export function probePolicy(cfg: WorldConfig, genome: Genome, opts: ProbeOptions = {}): PolicyMap {
	const bearings = opts.bearings ?? PROBE_BEARINGS;
	const radii = opts.radii ?? PROBE_RADII;
	const vision = cfg.vision;
	const agent = canonicalAgent(cfg, genome);

	const samples = new Array<PolicySample>(bearings * radii);
	let turnMin = Infinity;
	let turnMax = -Infinity;
	let thrustMin = Infinity;
	let thrustMax = -Infinity;

	for (let b = 0; b < bearings; b++) {
		const bearing = (2 * Math.PI * b) / bearings;
		for (let r = 0; r < radii; r++) {
			// Cell centres: (r + 0.5)/radii keeps every sample strictly inside vision, so none
			// lands on the edge where `inVis` flips the inputs to zero.
			const distance = (vision * (r + 0.5)) / radii;
			const s = samplePolicyAt(cfg, agent, adversaryAt(cfg, agent, bearing, distance));
			samples[b * radii + r] = s;
			if (s.turn < turnMin) turnMin = s.turn;
			if (s.turn > turnMax) turnMax = s.turn;
			if (s.thrust < thrustMin) thrustMin = s.thrust;
			if (s.thrust > thrustMax) thrustMax = s.thrust;
		}
	}

	const flat = turnMax - turnMin <= FLAT_EPS && thrustMax - thrustMin <= FLAT_EPS;
	return {
		bearings,
		radii,
		vision,
		samples,
		flat,
		turnRange: [turnMin, turnMax],
		thrustRange: [thrustMin, thrustMax]
	};
}
