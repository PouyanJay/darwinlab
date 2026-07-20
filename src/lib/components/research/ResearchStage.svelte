<!--
  The Research stage — the main view while the lab is in Research mode.

  It hosts the instruments behind a switcher. The Sweep is live; the Ledger and the Atlas are marked
  "soon" and disabled until their phases land, so the switcher already reads as the home all three
  will share rather than being rebuilt for each. Monochrome on purpose — colour belongs to a world's
  own accent, not to chrome.
-->
<script lang="ts">
	import Sweep from './Sweep/Sweep.svelte';
	import { SCENARIO } from '$lib/lab/scenario';

	type Instrument = 'sweep' | 'ledger' | 'atlas';

	const INSTRUMENTS: { key: Instrument; name: string; ready: boolean }[] = [
		{ key: 'sweep', name: 'The Sweep', ready: true },
		{ key: 'ledger', name: 'The Ledger', ready: false },
		{ key: 'atlas', name: 'The Atlas', ready: false }
	];

	let active = $state<Instrument>('sweep');
</script>

<div class="research" data-testid="research-stage">
	<div class="inner">
		<header>
			<span class="eyebrow">Research · {SCENARIO.index} · {SCENARIO.name}</span>
			<div class="tabs" role="group" aria-label="research instruments">
				{#each INSTRUMENTS as instrument (instrument.key)}
					<button
						class="tab"
						class:active={active === instrument.key}
						aria-pressed={active === instrument.key}
						disabled={!instrument.ready}
						onclick={() => (active = instrument.key)}
					>
						{instrument.name}{#if !instrument.ready}<span class="soon">soon</span>{/if}
					</button>
				{/each}
			</div>
		</header>

		{#if active === 'sweep'}
			<Sweep />
		{/if}
	</div>
</div>

<style>
	.research {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--sp-7) var(--sp-7) var(--sp-8);
		background: var(--bgfx);
	}

	.inner {
		width: 100%;
		max-width: 1000px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}

	header {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.tabs {
		display: flex;
		gap: var(--sp-5);
		border-bottom: 1px solid var(--line);
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 0 var(--sp-3);
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		background: none;
		color: var(--ink3);
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: color var(--dur-fast) var(--ease);
	}

	.tab:hover:not(:disabled) {
		color: var(--ink2);
	}

	.tab.active {
		color: var(--ink);
		border-bottom-color: var(--ink);
	}

	.tab:disabled {
		cursor: not-allowed;
	}

	.tab:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.soon {
		font-family: var(--font-display);
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 2px 6px;
	}
</style>
