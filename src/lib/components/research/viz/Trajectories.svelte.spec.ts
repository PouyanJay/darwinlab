import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { BoutTrace } from '$lib/harness/trace';
import Trajectories from './Trajectories.svelte';

const survivor = (x: number, y: number) => ({
	path: [
		{ x, y },
		{ x: x + 40, y: y + 30 },
		{ x: x + 80, y: y + 60 }
	],
	life: 10,
	died: false
});
const caught = (x: number, y: number) => ({
	path: [
		{ x, y },
		{ x: x - 40, y: y - 40 }
	],
	life: 4.2,
	died: true
});
const pred = [
	{ x: 400, y: 250 },
	{ x: 380, y: 240 },
	{ x: 360, y: 250 }
];

// Asymmetric on purpose: 1-of-2 survive here, 1-of-3 there, so a swapped outcome→mark mapping
// changes the ✕/dot totals (a symmetric fixture would hide it).
const panels = [
	{
		title: 'Evolved',
		trace: { bw: 800, bh: 500, seconds: 10, fish: [survivor(100, 100), caught(600, 400)], pred }
	},
	{
		title: 'Random control',
		trace: {
			bw: 800,
			bh: 500,
			seconds: 10,
			fish: [survivor(120, 350), caught(500, 120), caught(650, 300)],
			pred
		}
	}
] satisfies { title: string; trace: BoutTrace }[];

const svgs = (container: HTMLElement) => container.querySelectorAll('svg');

describe('Trajectories', () => {
	it('draws one mini-arena per population', () => {
		const { container } = render(Trajectories, { panels });

		expect(svgs(container)).toHaveLength(panels.length);
	});

	it('draws a path polyline for every fish across every panel', () => {
		const { container } = render(Trajectories, { panels });

		const fishCount = panels.reduce((n, p) => n + p.trace.fish.length, 0);
		expect(container.querySelectorAll('polyline.path')).toHaveLength(fishCount);
	});

	it('marks each caught fish with a coral ✕ and each survivor with a teal dot', () => {
		const { container } = render(Trajectories, { panels });

		const died = panels.reduce((n, p) => n + p.trace.fish.filter((f) => f.died).length, 0);
		const alive = panels.reduce((n, p) => n + p.trace.fish.filter((f) => !f.died).length, 0);

		// A ✕ is two crossed lines inside a .died group; a survivor is a single .alive dot.
		expect(container.querySelectorAll('.mark.died')).toHaveLength(died);
		expect(container.querySelectorAll('.mark.died line')).toHaveLength(died * 2);
		expect(container.querySelectorAll('circle.mark.alive')).toHaveLength(alive);
	});

	it('threads the predator through each arena as a dashed line', () => {
		const { container } = render(Trajectories, { panels });

		expect(container.querySelectorAll('polyline.pred')).toHaveLength(panels.length);
	});

	it('omits a fish whose path never got sampled', () => {
		const empty: BoutTrace = {
			bw: 800,
			bh: 500,
			seconds: 10,
			fish: [{ path: [], life: 0, died: true }],
			pred: []
		};
		const { container } = render(Trajectories, { panels: [{ title: 'Empty', trace: empty }] });

		expect(container.querySelectorAll('polyline.path')).toHaveLength(0);
		expect(container.querySelectorAll('.mark')).toHaveLength(0);
	});

	it('offers a table row per population with its survived tally', () => {
		const { container } = render(Trajectories, { panels });

		const bodyRows = [...container.querySelectorAll('tbody tr')];
		expect(bodyRows).toHaveLength(panels.length);
		expect(bodyRows[0].textContent).toContain('Evolved');
		expect(bodyRows[0].textContent).toContain('1 / 2');
		expect(bodyRows[1].textContent).toContain('Random control');
		expect(bodyRows[1].textContent).toContain('1 / 3');
	});

	it('reads back the panel titles as the graphic accessible label', () => {
		const { container } = render(Trajectories, { panels });

		const graphic = container.querySelector('[role="img"]');
		expect(graphic?.getAttribute('aria-label')).toContain('Evolved');
		expect(graphic?.getAttribute('aria-label')).toContain('Random control');
	});
});
