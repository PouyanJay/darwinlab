import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	use: {
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
