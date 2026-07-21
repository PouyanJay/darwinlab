<!--
  The Research stage — the main view while the lab is in Research mode.

  It hosts the instruments behind a switcher. The Sweep is live; the Ledger and the Atlas are marked
  "soon" and disabled until their phases land, so the switcher already reads as the home all three
  will share rather than being rebuilt for each. Monochrome on purpose — colour belongs to a world's
  own accent, not to chrome.
-->
<script lang="ts">
	import Sweep from './Sweep/Sweep.svelte';
	import Ledger from './Ledger/Ledger.svelte';
	import Atlas from './Atlas/Atlas.svelte';
	import Icon from '../common/Icon.svelte';
	import { SCENARIO } from '$lib/lab/scenario';
	import { app } from '$lib/state';

	type Instrument = 'sweep' | 'ledger' | 'atlas';

	const INSTRUMENTS: { key: Instrument; name: string; ready: boolean }[] = [
		{ key: 'sweep', name: 'The Sweep', ready: true },
		{ key: 'ledger', name: 'The Ledger', ready: true },
		{ key: 'atlas', name: 'The Atlas', ready: true }
	];

	let active = $state<Instrument>('sweep');

	/**
	 * A single-select tablist: exactly one instrument is active, so ←/→ move the choice among the
	 * READY tabs (the "soon" ones are disabled and skipped) and focus follows it — the roving-tabindex
	 * keyboard model the rest of the lab's grouped controls use.
	 */
	function move(delta: number) {
		const ready = INSTRUMENTS.filter((instrument) => instrument.ready).map((i) => i.key);
		const next = ready[(ready.indexOf(active) + delta + ready.length) % ready.length];
		active = next;
		document.getElementById(`rtab-${next}`)?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(1);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(-1);
		else return;
		event.preventDefault();
	}
</script>

<div class="research" data-testid="research-stage">
	<div class="inner">
		<header>
			<span class="eyebrow">Research · {SCENARIO.index} · {SCENARIO.name}</span>
			<div class="tabs" role="tablist" aria-label="research instruments">
				{#each INSTRUMENTS as instrument (instrument.key)}
					<button
						id="rtab-{instrument.key}"
						class="tab"
						class:active={active === instrument.key}
						role="tab"
						aria-selected={active === instrument.key}
						aria-controls="research-panel"
						tabindex={active === instrument.key ? 0 : -1}
						disabled={!instrument.ready}
						onclick={() => (active = instrument.key)}
						{onkeydown}
					>
						{instrument.name}{#if !instrument.ready}<span class="soon">soon</span>{/if}
					</button>
				{/each}
			</div>
		</header>

		{#if app.subject}
			<!-- A world was handed over from Studio ("Analyse"): every instrument now explores AROUND it.
			     The chip names it and offers the way back to a generic world, so the subject is never a
			     trap you can't see or leave. -->
			<div class="subject" data-testid="research-subject">
				<Icon name="flask" size={13} />
				<span class="subject-text">
					Analysing <b>{app.subject.name}</b> — the Sweep, the Ledger and the Atlas run on this world.
				</span>
				<button class="clear" onclick={() => app.clearSubject()}>Use a generic world</button>
			</div>
		{/if}

		<div id="research-panel" role="tabpanel" aria-labelledby="rtab-{active}">
			{#if active === 'sweep'}
				<Sweep />
			{:else if active === 'ledger'}
				<Ledger />
			{:else if active === 'atlas'}
				<Atlas />
			{/if}
		</div>
	</div>
</div>

<style>
	.research {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--sp-7) var(--sp-7) var(--sp-8);
		background: var(--bgfx);
		/* A gentle settle as the stage swaps in from Studio — the shared card-entrance, not a bespoke
		   one. Reduced-motion is handled globally in app.css (a blanket animation: none). */
		animation: fade-up var(--dur-slow) var(--ease) both;
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

	.subject {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		color: var(--ink2);
		font-size: var(--fs-sm);
	}

	.subject-text {
		flex: 1;
		min-width: 0;
	}

	.subject-text b {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	.clear {
		flex: none;
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: none;
		padding: 4px var(--sp-3);
		color: var(--ink2);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: border-color var(--dur-fast) var(--ease);
	}

	.clear:hover {
		border-color: var(--accent);
		color: var(--ink);
	}

	.clear:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}
</style>
