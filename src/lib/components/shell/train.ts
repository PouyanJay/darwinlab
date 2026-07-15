/**
 * What a "Train" press means — one answer, shared by the sidebar panel and the collapsed rail.
 *
 * Two controls that fast-forward the bench must fast-forward it to the SAME generation. Deriving
 * that twice is how they end up disagreeing the day one of them is edited.
 */

/** How far a burst fast-forwards when the lab has no deploy generation set (train forever). */
export const TRAIN_BURST = 25;

/** The generation a burst should run to, given where the bench is and where it is allowed to stop. */
export function trainTarget(generationsEvolved: number, maxGenerations: number): number {
	return maxGenerations || generationsEvolved + TRAIN_BURST;
}

export function trainLabel(maxGenerations: number): string {
	// "to the end" when there is a deploy generation (training stops there for good), a fixed burst
	// otherwise. The end IS the deploy generation, so the button names the thing, not the number.
	return maxGenerations ? 'Train to the end' : `Train +${TRAIN_BURST} gens`;
}
