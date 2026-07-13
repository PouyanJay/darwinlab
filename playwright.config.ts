import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	/*
	 * Two projects, and the second waits for the first.
	 *
	 * The measurement tests (n-seed evaluation, ablation matrix) burn real CPU — they replicate
	 * environments across seeds, which is the entire point of them. Run in parallel with the rest of
	 * the suite they starve the other workers, and the simulations those tests are watching crawl:
	 * what you see is a DIFFERENT story or bench test failing on each run, never the one at fault.
	 * Sequencing them after everything else means the heavy work happens with the machine to itself.
	 */
	projects: [
		{ name: 'app', testIgnore: '**/measure.e2e.ts' },
		{ name: 'measure', testMatch: '**/measure.e2e.ts', dependencies: ['app'] }
	],
	use: {
		/*
		 * The suite must also pass against a GitHub Pages-style build (BASE_PATH=/darwinlab),
		 * where the app lives under a sub-path instead of the origin root. baseURL carries that
		 * sub-path, so tests navigate with gotoApp() (a base-relative "."), never goto('/') —
		 * an absolute path resolves against the origin and would silently escape the base.
		 */
		baseURL: `http://localhost:4173${process.env.BASE_PATH ?? ''}/`,
		// Keep traces for CI post-mortems. No retries anywhere, deliberately: a flake retried
		// into green is a flake nobody fixes.
		trace: process.env.CI ? 'retain-on-failure' : 'off',
		/*
		 * Pin the colour scheme. The app follows prefers-color-scheme on a first visit, so without
		 * this the suite runs in whichever theme the machine happens to prefer — and the two themes
		 * are not cosmetic variants of each other: the tank's predators are coral in one and magenta
		 * in the other. The inspector's shark test finds a shark by its colour, and would have started
		 * failing on a dark-preferring runner with a message about there being no sharks.
		 * Tests that care about the other theme switch to it explicitly.
		 */
		colorScheme: 'light'
	}
});
