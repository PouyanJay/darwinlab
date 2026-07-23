/**
 * Statistics for Research — the honest math over what an evaluation already measures.
 *
 * `evaluate()` returns `returns: number[]`, one seconds-survived figure per independent seed. This
 * module turns those samples into the things a conclusion is made of: a mean, a confidence interval
 * that does not overstate what a handful of seeds can tell you, a standardized effect size, and a
 * two-arm contrast. Nothing here re-measures anything — it is arithmetic over the returns.
 *
 * The confidence intervals are BOOTSTRAP intervals, and the resampling runs off a SEEDED rng by
 * default, so the same data always yields the same interval — reproducible, like every other number
 * the lab reports. Pass your own rng to vary it.
 *
 * Pure: no Svelte, no DOM. It is imported by the worker as readily as by a component.
 */

import { seededRng } from '../engine';

export interface Interval {
	lo: number;
	hi: number;
}

export interface Contrast {
	/** mean(a) − mean(b), in the sample's own units (seconds). */
	delta: number;
	/** Bootstrap confidence interval on `delta`. Clears zero ⇒ a real difference at this level. */
	ci: Interval;
	/** Cohen's d — the difference in pooled-standard-deviation units. */
	d: number;
}

export interface BootstrapOptions {
	/** Two-sided miss rate: 0.05 → a 95% interval. */
	alpha?: number;
	/** Resamples. More is smoother and slower; 2000 is plenty for a handful of seeds. */
	resamples?: number;
	/** The randomness source. Seeded by default so an interval is reproducible from its data. */
	rng?: () => number;
}

export function mean(xs: number[]): number {
	if (xs.length === 0) return NaN;
	return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population standard deviation (÷n) — the same error bar `evaluate()` reports as `sdReturn`. */
export function stdev(xs: number[]): number {
	if (xs.length === 0) return NaN;
	const m = mean(xs);
	return Math.sqrt(xs.reduce((a, v) => a + (v - m) ** 2, 0) / xs.length);
}

/** Sample variance (÷n−1) — the unbiased estimator Cohen's d's pooled sd is built from. */
function sampleVariance(xs: number[]): number {
	if (xs.length < 2) return 0;
	const m = mean(xs);
	return xs.reduce((a, v) => a + (v - m) ** 2, 0) / (xs.length - 1);
}

/** Linear-interpolated percentile of an already-sorted ascending array. `p` in [0, 1]. */
function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return NaN;
	if (sorted.length === 1) return sorted[0];
	const rank = p * (sorted.length - 1);
	const lo = Math.floor(rank);
	const hi = Math.ceil(rank);
	return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/** The two-sided interval from a sorted bootstrap distribution — shared by both bootstrap functions. */
function boundsFrom(sortedValues: number[], alpha: number): Interval {
	return { lo: percentile(sortedValues, alpha / 2), hi: percentile(sortedValues, 1 - alpha / 2) };
}

/** The bootstrap defaults, resolved once so the two callers cannot silently diverge. */
function resolveOptions(options: BootstrapOptions): Required<BootstrapOptions> {
	return {
		alpha: options.alpha ?? 0.05,
		resamples: options.resamples ?? 2000,
		rng: options.rng ?? seededRng(1)
	};
}

/** One bootstrap resample's mean: draw `xs.length` values with replacement and average them. */
function resampleMean(xs: number[], rng: () => number): number {
	let sum = 0;
	for (let i = 0; i < xs.length; i++) sum += xs[Math.floor(rng() * xs.length)];
	return sum / xs.length;
}

/**
 * A bootstrap confidence interval for the mean of `xs`.
 *
 * With no variation in the sample the interval collapses to the value itself — a bootstrap of
 * identical numbers can only ever resample identical numbers, which is the honest answer.
 */
export function bootstrapCI(xs: number[], options: BootstrapOptions = {}): Interval {
	if (xs.length === 0) return { lo: NaN, hi: NaN };
	const { alpha, resamples, rng } = resolveOptions(options);

	const means: number[] = [];
	for (let r = 0; r < resamples; r++) means.push(resampleMean(xs, rng));
	means.sort((a, b) => a - b);
	return boundsFrom(means, alpha);
}

/**
 * Cohen's d — how far apart two samples are, measured in their shared spread. The denominator is
 * the pooled SAMPLE standard deviation (÷n−1), the conventional definition. Zero spread ⇒ zero
 * (a difference with no scale to measure it against is not an effect size).
 */
export function cohensD(a: number[], b: number[]): number {
	const na = a.length;
	const nb = b.length;
	if (na + nb < 3) return 0;
	const pooledVar = ((na - 1) * sampleVariance(a) + (nb - 1) * sampleVariance(b)) / (na + nb - 2);
	const pooledSd = Math.sqrt(pooledVar);
	return pooledSd === 0 ? 0 : (mean(a) - mean(b)) / pooledSd;
}

/** A contrast with no standardized effect size — the interaction's shape (Cohen's d has no clean
 *  meaning for a difference of differences, so none is invented). */
export interface DifferenceContrast {
	delta: number;
	ci: Interval;
}

/**
 * The 2×2 INTERACTION contrast: (A's effect with B at its top) − (A's effect with B at its bottom),
 * i.e. (mean(tt) − mean(bt)) − (mean(tb) − mean(bb)) where the first letter is A's level and the
 * second is B's. The bootstrap resamples all four pools independently. An interval clearing zero
 * means A's value genuinely DEPENDS on B — parallel lines are the null.
 */
export function interactionContrast(
	tt: number[],
	tb: number[],
	bt: number[],
	bb: number[],
	options: BootstrapOptions = {}
): DifferenceContrast {
	if ([tt, tb, bt, bb].some((arm) => arm.length === 0)) {
		return { delta: NaN, ci: { lo: NaN, hi: NaN } };
	}
	const { alpha, resamples, rng } = resolveOptions(options);
	const statistic = (a: number, b: number, c: number, d: number) => a - c - (b - d);
	const delta = statistic(mean(tt), mean(tb), mean(bt), mean(bb));

	const deltas: number[] = [];
	for (let r = 0; r < resamples; r++) {
		deltas.push(
			statistic(
				resampleMean(tt, rng),
				resampleMean(tb, rng),
				resampleMean(bt, rng),
				resampleMean(bb, rng)
			)
		);
	}
	deltas.sort((x, y) => x - y);
	return { delta, ci: boundsFrom(deltas, alpha) };
}

/**
 * The two-arm contrast a verdict is built on: the difference of means, a bootstrap interval on that
 * difference (resampling each arm independently), and Cohen's d. The interval clearing zero is what
 * makes "a pays more than b" a claim rather than a hope.
 */
export function contrast(a: number[], b: number[], options: BootstrapOptions = {}): Contrast {
	// An empty arm has no difference to report — say so, rather than returning a delta of NaN dressed
	// as a number, mirroring bootstrapCI's explicit empty handling.
	if (a.length === 0 || b.length === 0) return { delta: NaN, ci: { lo: NaN, hi: NaN }, d: NaN };
	const { alpha, resamples, rng } = resolveOptions(options);
	const delta = mean(a) - mean(b);

	const deltas: number[] = [];
	for (let r = 0; r < resamples; r++) deltas.push(resampleMean(a, rng) - resampleMean(b, rng));
	deltas.sort((x, y) => x - y);

	return { delta, ci: boundsFrom(deltas, alpha), d: cohensD(a, b) };
}
