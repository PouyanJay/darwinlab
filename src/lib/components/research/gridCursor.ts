/**
 * The keyboard cursor gesture shared by the console's canvas grids (the Atlas landscape and the Sweep
 * run grid): an arrow key maps to a step across the grid. The two grids keep their own field names
 * (ix/iy vs condition/seed) and bounds, but the direction decode is one contract, here.
 */
export const ARROW_STEP: Record<string, [number, number]> = {
	ArrowRight: [1, 0],
	ArrowLeft: [-1, 0],
	ArrowDown: [0, 1],
	ArrowUp: [0, -1]
};
