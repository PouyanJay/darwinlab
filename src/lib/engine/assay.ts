/**
 * The flee assay: stop watching chaos, and ask the fish a question.
 *
 * A free-running tank answers nothing on demand. The shark goes where it goes, the fish that meet it
 * are whichever happened to be nearby, and what you see is an anecdote. So: stage it. Put ONE fish in
 * the middle, facing a known way, and drop a shark at a known bearing and a known distance. Watch
 * what the fish does. Then do it again at the next bearing, and the next, all the way round.
 *
 * A blind fish turns whichever way it was already turning. A bearing-sensing fish turns away — every
 * time, on demand, in front of you. That is the difference the metrics have always seen and the tank
 * never showed, and this is the shape of experiment that shows it: a lab assay, not a nature film.
 *
 * ⚠️ WHAT IT SCORES, AND WHY IT IS NOT FLEE ERROR.
 *
 * The obvious verdict — mean flee error across the trial — is WRONG, and it was measured to be wrong
 * before this file settled on anything else. A fish that swims steadily in ANY fixed direction sees
 * its own flee error collapse for free: as it displaces itself, the away-from-the-shark vector rotates
 * towards its velocity, so the angle between them shrinks whether or not the fish has the faintest
 * idea the shark exists. Blind champions that had merely evolved to swim fast and straight scored 43°
 * on it — better than a bearing-sensing brain — which is a metric measuring displacement and calling
 * it perception.
 *
 * So the assay scores THE DECISION: at the instant the shark appears at a known bearing, does the
 * fish turn the right way? Heading is intrinsic — it cannot be earned by moving — and the answer is a
 * clean yes/no per bearing. A brain with no information turns correctly half the time, by definition.
 * A brain that can feel the bearing does better, and how much better is the whole experiment.
 *
 * ONE CODE PATH, TWO PRESENTATIONS. The trials the browser plays and the trials the harness scores
 * are the same trials, stepped by the same functions, in the same order. A "visual mode" that ran its
 * own private simulation would be a demo pretending to be a measurement — the two would drift, and
 * the picture would stop being evidence for the number printed beside it.
 */

import { TAU } from './math';
import { makeWorld } from './world';
import { stepWorld } from './world';
import { cloneGenome } from './genetics';
import { seededRng } from './rng';
import { fleeError } from './flee';
import type { Genome, World, WorldConfig } from './types';

/** How many bearings a full assay walks — every 30°, all the way round. */
export const ASSAY_BEARINGS = 12;
/** How far the shark starts from the fish. Inside vision, so the fish can actually be asked. */
export const ASSAY_DISTANCE = 150;
/** How long a single trial runs, in sim-seconds, before it is scored a survival. */
export const ASSAY_SECONDS = 4;
/**
 * The REACTION WINDOW: how long the fish is given to answer, in sim-seconds.
 *
 * The turn is judged over this window and no longer. After it, the chase geometry takes over and what
 * the fish is doing stops being an answer to the question it was asked.
 */
export const ASSAY_REACTION = 1;
/**
 * A bearing whose required turn is within this of 0° or 180° is NOT ASKED.
 *
 * Dead astern, the fish is already fleeing and there is nothing to decide. Dead ahead, a left turn and
 * a right turn are equally correct, so "which way did it turn" has no right answer. Scoring those as
 * hits or misses would be scoring a coin toss and reporting it as skill.
 */
export const ASSAY_AMBIGUOUS_DEG = 20;

const DT = 1 / 60;

/** How a trial is staged. Parameters, not constants: the assay's difficulty is a thing to measure. */
export interface TrialSetup {
	seed?: number;
	/** How far the shark starts from the fish, in world px. */
	distance?: number;
	/** How long the trial runs before the fish is scored a survivor, in sim-seconds. */
	seconds?: number;
}

export interface Trial {
	/** Where the shark was placed, in degrees CLOCKWISE of the fish's nose. 0 = dead ahead. */
	bearingDeg: number;
	world: World;
	elapsed: number;
	/** The trial's own length — a trial knows when it is over; the stepper does not decide. */
	seconds: number;
	/** Accumulated flee error over the trial — reported for reference; NOT the verdict (see above). */
	errorSum: number;
	errorN: number;
	eaten: boolean;

	// ---- the decision, which is what this assay is actually for ----
	/** The heading the fish was on when the shark appeared. */
	startHeading: number;
	/** The turn it SHOULD make: −1 to port, +1 to starboard, 0 if the bearing has no right answer. */
	requiredTurn: -1 | 0 | 1;
	/** How far, and which way, it has actually turned since — signed, and accumulated, so a fish that
	 *  wanders back does not get credit for the moment it happened to be pointing the right way. */
	turnedRad: number;
	/** The turn is judged over the reaction window only. */
	reaction: number;
}

export interface BearingResult {
	bearingDeg: number;
	/**
	 * THE VERDICT: did it turn towards escape? `null` means the bearing was not asked — the required
	 * turn was ambiguous (see ASSAY_AMBIGUOUS_DEG), so there was no right answer to get right.
	 */
	turnedRight: boolean | null;
	/** How far it turned in the reaction window, degrees (unsigned). A fish that froze turned 0. */
	turnedDeg: number;
	/** Mean flee error across the trial. Reported, not judged — see the note at the top of this file. */
	fleeErrorDeg: number | null;
	/** Did it survive the trial? */
	escaped: boolean;
	/** Seconds it lasted (the full trial length, if it escaped). */
	survivedS: number;
}

export interface AssayResult {
	bearings: BearingResult[];
	/** Of the bearings that HAD a right answer, the share the fish got right. Chance is 0.5. */
	turnAccuracy: number | null;
	/** How many bearings were actually asked (the rest had no right answer). */
	asked: number;
	/** Share of bearings the fish survived. */
	escapeRate: number;
	/** Mean flee error across every bearing that produced a reading. Context, not verdict. */
	meanFleeErrorDeg: number | null;
}

/** One bearing, answered by a whole POPULATION rather than by one fish. */
export interface BearingConsensus {
	bearingDeg: number;
	/** How many brains were asked here (a bearing with no right answer asks nobody). */
	asked: number;
	/** How many of them turned towards escape. */
	right: number;
	/** `right / asked`, or null where nobody was asked. Chance is 0.5. */
	share: number | null;
	/** Mean turn made at this bearing, degrees — how HARD they reacted, not just which way. */
	meanTurnDeg: number;
	/** Share of the brains that survived this bearing. */
	escapeRate: number;
}

/**
 * The assay's real verdict: a whole population, asked from every direction.
 *
 * ONE brain answers about ten scoreable bearings, and ten coin flips carry a standard error of some
 * sixteen percentage points — so a single champion can measure 50% one run and 70% the next while
 * nothing about it has changed. That is not an instrument, it is a rumour with a decimal point. It
 * showed up the moment the browser ran the same assay twice.
 *
 * So the number is the POPULATION's: every living brain, every bearing, a few hundred decisions, and
 * an error bar small enough to tell a blind world from a bearing-sensing one. The champion's trials
 * are still what you WATCH — one brain is what a tank can show — but they are the illustration, and
 * this is the measurement.
 */
export interface PopulationAssay {
	bearings: BearingConsensus[];
	/** Every scoreable decision, across every brain. Chance is 0.5. */
	turnAccuracy: number | null;
	/** How many decisions that was — the n behind the number. */
	asked: number;
	/** How many brains were questioned. */
	brains: number;
	escapeRate: number;
}

/** Ask a whole population. Headless and fast: a trial is one fish and one shark for a few seconds. */
export function runPopulationAssay(
	cfg: WorldConfig,
	genomes: Genome[],
	setup: TrialSetup = {}
): PopulationAssay {
	const degrees = assayBearings();
	const byBearing = new Map<number, BearingResult[]>(degrees.map((deg) => [deg, []]));

	for (const genome of genomes) {
		for (const deg of degrees) {
			const trial = makeTrial(cfg, genome, deg, setup);
			while (!stepTrial(trial));
			byBearing.get(deg)!.push(scoreTrial(trial));
		}
	}

	const bearings: BearingConsensus[] = degrees.map((deg) => {
		const rows = byBearing.get(deg)!;
		const asked = rows.filter((r) => r.turnedRight !== null);
		const right = asked.filter((r) => r.turnedRight).length;
		return {
			bearingDeg: deg,
			asked: asked.length,
			right,
			share: asked.length ? right / asked.length : null,
			meanTurnDeg: rows.length ? rows.reduce((sum, r) => sum + r.turnedDeg, 0) / rows.length : 0,
			escapeRate: rows.length ? rows.filter((r) => r.escaped).length / rows.length : 0
		};
	});

	const asked = bearings.reduce((sum, b) => sum + b.asked, 0);
	const right = bearings.reduce((sum, b) => sum + b.right, 0);
	const escapes = bearings.reduce((sum, b) => sum + b.escapeRate, 0);

	return {
		bearings,
		turnAccuracy: asked ? right / asked : null,
		asked,
		brains: genomes.length,
		escapeRate: bearings.length ? escapes / bearings.length : 0
	};
}

/**
 * Stage one trial: one fish, facing +x, with one shark dropped at `bearingDeg` off its nose.
 *
 * The world is the environment's OWN config (its shark speed, its vision, its senses) with the
 * populations forced to one and one — an assay run in some other world's conditions would answer a
 * question nobody asked. It is seeded, so the same brain at the same bearing gives the same trial
 * every time: that is what makes it an assay rather than an anecdote.
 */
export function makeTrial(
	cfg: WorldConfig,
	genome: Genome,
	bearingDeg: number,
	{ seed = 1, distance = ASSAY_DISTANCE, seconds = ASSAY_SECONDS }: TrialSetup = {}
): Trial {
	const staged: WorldConfig = { ...cfg, prey: 1, preds: 1 };
	const world = makeWorld(staged, [cloneGenome(genome)], seededRng(seed));

	const fish = world.fish[0];
	fish.x = staged.bw / 2;
	fish.y = staged.bh / 2;
	fish.heading = 0; // facing +x, so a bearing is read straight off the nose
	fish.vx = 60; // already swimming: a fish at rest has no heading worth reading (see flee.ts)
	fish.vy = 0;
	fish.trail = [];

	const rad = (bearingDeg * TAU) / 360;
	const pred = world.preds[0];
	pred.x = fish.x + Math.cos(rad) * distance;
	pred.y = fish.y + Math.sin(rad) * distance;
	pred.heading = rad + Math.PI; // pointed at the fish
	pred.vx = 0;
	pred.vy = 0;
	pred.trail = [];

	/*
	 * What escape REQUIRES from this bearing, decided once, at the start — before the fish has moved
	 * and before the geometry can drift. Dead astern there is nothing to decide, and dead ahead a left
	 * turn and a right turn are equally right, so those bearings are not asked at all.
	 */
	const away = Math.atan2(fish.y - pred.y, fish.x - pred.x);
	const needed = signedAngle(away - fish.heading);
	const neededDeg = Math.abs((needed * 360) / TAU);
	const ambiguous = neededDeg < ASSAY_AMBIGUOUS_DEG || neededDeg > 180 - ASSAY_AMBIGUOUS_DEG;

	return {
		bearingDeg,
		world,
		elapsed: 0,
		seconds,
		errorSum: 0,
		errorN: 0,
		eaten: false,
		startHeading: fish.heading,
		requiredTurn: ambiguous ? 0 : needed > 0 ? 1 : -1,
		turnedRad: 0,
		reaction: ASSAY_REACTION
	};
}

/** Wrap an angle into (−π, π] — the shortest way round, which is the only way a turn is measured. */
function signedAngle(a: number): number {
	let x = a % TAU;
	if (x > Math.PI) x -= TAU;
	if (x < -Math.PI) x += TAU;
	return x;
}

/** Advance a trial one frame. Returns true when it is over (the fish is eaten, or time is up). */
export function stepTrial(trial: Trial, dt: number = DT): boolean {
	if (trialDone(trial)) return true;

	const before = trial.world.fish[0]?.heading ?? 0;
	stepWorld(trial.world, dt);
	trial.elapsed += dt;

	const fish = trial.world.fish[0];
	if (!fish) {
		trial.eaten = true;
		return true;
	}

	// The turn, accumulated the short way round, and only while the question is still being asked.
	if (trial.elapsed <= trial.reaction) {
		trial.turnedRad += signedAngle(fish.heading - before);
	}

	const err = fleeError(trial.world.cfg, fish, trial.world.preds);
	if (err !== null) {
		trial.errorSum += err;
		trial.errorN++;
	}
	return trialDone(trial);
}

export function trialDone(trial: Trial): boolean {
	return trial.eaten || trial.elapsed >= trial.seconds;
}

export function scoreTrial(trial: Trial): BearingResult {
	const turnedDeg = Math.abs((trial.turnedRad * 360) / TAU);
	return {
		bearingDeg: trial.bearingDeg,
		// Asked, and answered: did it turn the way escape required? A bearing with no right answer is
		// not scored at all — reporting a coin toss as a hit or a miss is how a metric starts lying.
		turnedRight:
			trial.requiredTurn === 0 ? null : Math.sign(trial.turnedRad) === trial.requiredTurn,
		turnedDeg,
		fleeErrorDeg: trial.errorN ? trial.errorSum / trial.errorN : null,
		escaped: !trial.eaten,
		survivedS: trial.elapsed
	};
}

/** Fold a set of bearing results into the assay's verdict. */
export function summarise(bearings: BearingResult[]): AssayResult {
	const asked = bearings.filter((b) => b.turnedRight !== null);
	const right = asked.filter((b) => b.turnedRight).length;
	const read = bearings.filter((b) => b.fleeErrorDeg !== null);
	const escaped = bearings.filter((b) => b.escaped).length;

	return {
		bearings,
		turnAccuracy: asked.length ? right / asked.length : null,
		asked: asked.length,
		escapeRate: bearings.length ? escaped / bearings.length : 0,
		meanFleeErrorDeg: read.length
			? read.reduce((sum, b) => sum + b.fleeErrorDeg!, 0) / read.length
			: null
	};
}

/** Every bearing the assay walks, in degrees. */
export function assayBearings(count = ASSAY_BEARINGS): number[] {
	return Array.from({ length: count }, (_, i) => Math.round((i * 360) / count));
}

/** Run the whole assay headlessly — the same trials the browser plays, as fast as the CPU allows. */
export function runAssay(cfg: WorldConfig, genome: Genome, setup: TrialSetup = {}): AssayResult {
	const bearings = assayBearings().map((deg) => {
		const trial = makeTrial(cfg, genome, deg, setup);
		while (!stepTrial(trial));
		return scoreTrial(trial);
	});
	return summarise(bearings);
}
