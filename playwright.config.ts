import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	/*
	 * ONE WORKER ON CI. Nearly every test here drives the real sim loop — a visibility-safe timer
	 * stepping five live tanks — and parallel workers on a 2-vCPU runner starve each other's loops. A
	 * starved loop advances the world too slowly, so a DIFFERENT timing assertion misses on each run
	 * (a story stuck a generation behind, an arrow-walk landing before a creature spawned). That is the
	 * exact "different test fails each run under contention" pattern CLAUDE.md warns about, and it is
	 * why there are no retries: a flake retried into green is a flake nobody fixes. Serial on CI is
	 * slower and deterministic. Local stays parallel for a fast iteration loop.
	 */
	workers: process.env.CI ? 1 : undefined,
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
