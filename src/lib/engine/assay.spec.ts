import { describe, it, expect } from 'vitest';
import {
	makeTrial,
	stepTrial,
	scoreTrial,
	runPopulationAssay,
	assayBearings,
	ASSAY_AMBIGUOUS_DEG
} from './assay';
import { makeWorld, seededRng, DEFAULT_WORLDS, TAU } from './index';
import type { WorldConfig } from './types';

const BLIND: WorldConfig = DEFAULT_WORLDS[0];
const DIRECTION: WorldConfig = DEFAULT_WORLDS[2];

/** A population of random brains, built the way the engine builds them. */
function randomBrains(cfg: WorldConfig, n: number, seed: number) {
	const w = makeWorld({ ...cfg, prey: n }, undefined, seededRng(seed));
	return w.fish.map((f) => f.genome);
}

describe('the staged trial', () => {
	it('puts the shark exactly where it says, and the fish facing the nose it measures from', () => {
		const genome = randomBrains(DIRECTION, 1, 3)[0];
		const trial = makeTrial(DIRECTION, genome, 90);

		const fish = trial.world.fish[0];
		const pred = trial.world.preds[0];
		expect(fish.heading).toBe(0); // every bearing is read off this
		// 90° = off the fish's starboard beam: same x, greater y
		expect(pred.x).toBeCloseTo(fish.x, 6);
		expect(pred.y).toBeGreaterThan(fish.y);
		expect(Math.hypot(pred.x - fish.x, pred.y - fish.y)).toBeCloseTo(150, 6);
	});

	it('does not ask the bearings that have no right answer', () => {
		const genome = randomBrains(DIRECTION, 1, 3)[0];

		// Dead astern: the fish is already fleeing, so there is nothing to decide.
		expect(makeTrial(DIRECTION, genome, 180).requiredTurn).toBe(0);
		// Dead ahead: port and starboard are equally correct. Scoring it would be scoring a coin toss.
		expect(makeTrial(DIRECTION, genome, 0).requiredTurn).toBe(0);

		// And it asks the ones that do have one, in the right direction: a shark off the starboard beam
		// must be fled to port.
		expect(makeTrial(DIRECTION, genome, 90).requiredTurn).toBe(-1);
		expect(makeTrial(DIRECTION, genome, 270).requiredTurn).toBe(1);
	});

	it('scores the TURN, and a bearing with no right answer is scored as no answer', () => {
		const genome = randomBrains(DIRECTION, 1, 3)[0];

		const asked = makeTrial(DIRECTION, genome, 90); // must turn to port (−)
		asked.turnedRad = -0.4;
		expect(scoreTrial(asked).turnedRight).toBe(true);
		asked.turnedRad = 0.4;
		expect(scoreTrial(asked).turnedRight).toBe(false);

		const notAsked = makeTrial(DIRECTION, genome, 180);
		notAsked.turnedRad = 0.4;
		expect(scoreTrial(notAsked).turnedRight).toBeNull(); // not "wrong" — not asked
	});

	it('judges the turn over the reaction window, not the whole chase', () => {
		/*
		 * The window is the point. After it, the fish is being chased, and a fish that is being chased
		 * turns for reasons that have nothing to do with the question it was asked.
		 */
		const genome = randomBrains(DIRECTION, 1, 3)[0];
		const trial = makeTrial(DIRECTION, genome, 90);

		while (trial.elapsed < trial.reaction) stepTrial(trial);
		const atWindow = trial.turnedRad;

		while (!stepTrial(trial));
		expect(trial.turnedRad).toBe(atWindow); // nothing after the window counted
		expect(trial.elapsed).toBeGreaterThan(trial.reaction); // …and it really did keep running
	});
});

describe('the population assay', () => {
	it('asks every brain about every bearing that has an answer', () => {
		const brains = randomBrains(BLIND, 6, 11);
		const result = runPopulationAssay(BLIND, brains);

		expect(result.brains).toBe(6);
		expect(result.bearings).toHaveLength(assayBearings().length);
		// Two of the twelve bearings have no right answer (dead ahead and dead astern), so they are not
		// asked of anybody — see ASSAY_AMBIGUOUS_DEG.
		const asked = result.bearings.filter((b) => b.share !== null);
		expect(asked.length).toBeLessThan(result.bearings.length);
		expect(result.asked).toBe(asked.reduce((sum, b) => sum + b.asked, 0));
		expect(ASSAY_AMBIGUOUS_DEG).toBeGreaterThan(0);
	});

	it('THE SCIENCE GATE: brains that cannot feel the shark turn the right way HALF the time', () => {
		/*
		 * This is the assay's calibration, and the reason the whole metric was rewritten: a population
		 * with no information about where the shark is must score chance. Not "roughly better than
		 * nothing" — chance, 50%, because a coin has no bias.
		 *
		 * The previous verdict (mean flee error) failed this: blind brains scored far better than
		 * chance on it, because a fish swimming in a straight line rotates the away-vector onto its own
		 * velocity for free. If this test ever drifts away from 50%, the metric has started measuring
		 * something other than the decision — and every number the assay prints is worthless.
		 */
		const blind = randomBrains(BLIND, 20, 7);
		const result = runPopulationAssay(BLIND, blind);

		expect(result.asked).toBeGreaterThan(150); // a real n, not a rumour
		expect(result.turnAccuracy).toBeGreaterThan(0.38);
		expect(result.turnAccuracy).toBeLessThan(0.62);
	});

	it('is deterministic: the same brains asked twice give the same answer', () => {
		const brains = randomBrains(DIRECTION, 4, 9);
		const a = runPopulationAssay(DIRECTION, brains, { seed: 5 });
		const b = runPopulationAssay(DIRECTION, brains, { seed: 5 });

		// An assay that answered differently each time would be an anecdote generator.
		expect(a.turnAccuracy).toBe(b.turnAccuracy);
		expect(a.bearings.map((x) => x.share)).toEqual(b.bearings.map((x) => x.share));
	});

	it("reports the bearing a brain was asked from, in the fish's own frame", () => {
		const brains = randomBrains(DIRECTION, 2, 13);
		const result = runPopulationAssay(DIRECTION, brains);
		expect(result.bearings.map((b) => b.bearingDeg)).toEqual(assayBearings());
		expect(assayBearings()[3]).toBe(90); // a quarter turn round, off the starboard beam
		expect(TAU).toBeCloseTo(Math.PI * 2, 9);
	});
});
