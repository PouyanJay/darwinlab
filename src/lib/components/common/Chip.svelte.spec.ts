import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Chip from './Chip.svelte';
import { text } from './testkit';

describe('Chip', () => {
	it('is inert: it carries a label, never an interaction', () => {
		const { container } = render(Chip, { children: text('live evolution'), variant: 'tag' });
		const chip = container.firstElementChild!;

		expect(chip.textContent).toContain('live evolution');
		// It renders as a bare <span> with no interactive role: a chip you can click is a Button, and
		// this fails the moment someone reaches for a <button> or a role here instead.
		expect(chip.tagName).toBe('SPAN');
		expect(chip.hasAttribute('role')).toBe(false);
	});

	it("composes a caller's class with its own instead of being overwritten by it", () => {
		// The world tile's index badge does exactly this. A spread wins over an earlier attribute, so
		// before the fix `class="badge"` REPLACED the chip's styling and the badge lost its shape.
		const { container } = render(Chip, { children: text('01'), variant: 'tag', class: 'badge' });
		const chip = container.firstElementChild!;

		expect(chip.classList.contains('badge')).toBe(true);
		expect(chip.classList.contains('chip')).toBe(true);
		expect(chip.classList.contains('tag')).toBe(true);
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
