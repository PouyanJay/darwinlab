import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Chip from './Chip.svelte';
import { text } from './testkit';

describe('Chip', () => {
	it('is inert: it carries a label, never an interaction', () => {
		const { container } = render(Chip, { children: text('live evolution'), variant: 'tag' });
		const chip = container.querySelector('span')!;

		expect(chip.textContent).toContain('live evolution');
		expect(chip.tabIndex).toBe(-1); // not in the tab order — a clickable chip is a Button
	});

	it('takes a per-world accent, so each tile can tint its own badge', () => {
		const { container } = render(Chip, {
			children: text('01'),
			tone: 'accent',
			style: '--chip-accent: rgb(14, 148, 136)' // the teal from ACCENTS
		});

		const chip = container.querySelector('span')!;
		expect(getComputedStyle(chip).color).toBe('rgb(14, 148, 136)');
	});
});
