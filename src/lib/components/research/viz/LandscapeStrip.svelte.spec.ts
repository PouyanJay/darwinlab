import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LandscapeStrip from './LandscapeStrip.svelte';

const AXIS = 'wall clamp';
const px = (x: number) => `${x}px`;
const band = [
	{ x: 0, survival: 5 },
	{ x: 10, survival: 22 },
	{ x: 20, survival: 8 }
];

const base = { band, axisLabel: AXIS, format: px };

describe('LandscapeStrip', () => {
	it('paints one segment per band point', () => {
		const { container } = render(LandscapeStrip, base);

		expect(container.querySelectorAll('.seg')).toHaveLength(band.length);
	});

	it('marks the cliff only when a threshold is given', () => {
		const withCliff = render(LandscapeStrip, { ...base, cliffX: 12 }).container;
		expect(withCliff.querySelector('.cliff')).not.toBeNull();

		const withoutCliff = render(LandscapeStrip, base).container;
		expect(withoutCliff.querySelector('.cliff')).toBeNull();
	});

	it('backs the strip with a table in the SAME order as the band, formatted', () => {
		const { container } = render(LandscapeStrip, base);
		const rows = [...container.querySelectorAll('tbody tr')];

		// The whole band, in order — checking the endpoints too, so a reversed row order can't slip
		// past on the odd-length array's fixed midpoint.
		expect(rows.map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent))).toEqual(
			band.map((b) => [px(b.x), `${b.survival.toFixed(1)}s`])
		);
	});

	it('names the axis in the graphic label a screen reader hears', () => {
		const { container } = render(LandscapeStrip, base);
		const graphic = container.querySelector('[role="img"]');

		expect(graphic?.getAttribute('aria-label')).toContain(AXIS);
	});
});
