<!--
  The console's left rail: what the lab is pointed at, and what you can do to it.

  Top to bottom: the mode's name, the SUBJECT (the world every instrument runs on), the INSTRUMENT
  nav (a tablist — one instrument shows in the workspace at a time), and a compute readout at the
  foot. The chrome is monochrome on purpose — the active instrument reads through ink and a raised
  panel, never a colour; teal and coral belong to the graphs, not the furniture.

  The nav is a proper tablist so it keeps the roving-tabindex keyboard model the lab's grouped
  controls share: ←/→ move the choice among the READY instruments (the not-yet-built Report is skipped)
  and focus follows. The panel it controls lives in the workspace; the shared `research-panel` id wires
  them across the two subtrees.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import SubjectCard from './SubjectCard.svelte';
	import { INSTRUMENTS, readyInstrumentKeys, type Instrument } from './instruments';
	import { research } from '$lib/state';

	let { active, onselect }: { active: Instrument; onselect: (key: Instrument) => void } = $props();

	/** How many logical cores the worker pool can spread across — a static fact of the machine. */
	const cores = browser ? navigator.hardwareConcurrency || null : null;

	/**
	 * Move the selection among the READY instruments and take focus with it — the roving-tabindex
	 * model. Disabled instruments (the Report) are not in `readyInstrumentKeys`, so ←/→ steps over
	 * them rather than landing on a tab that does nothing.
	 */
	function move(delta: number) {
		const at = readyInstrumentKeys.indexOf(active);
		const next =
			readyInstrumentKeys[(at + delta + readyInstrumentKeys.length) % readyInstrumentKeys.length];
		onselect(next);
		document.getElementById(`rtab-${next}`)?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') move(1);
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') move(-1);
		else return;
		event.preventDefault();
	}
</script>

<nav class="rail" data-testid="research-rail" aria-label="research">
	<div class="brand">
		<span class="brand-name">Research</span>
	</div>

	<section class="sec">
		<span class="eyebrow">Subject</span>
		<SubjectCard />
	</section>

	<section class="sec">
		<span class="eyebrow">Instruments</span>
		<div class="nav" role="tablist" aria-label="research instruments" aria-orientation="vertical">
			{#each INSTRUMENTS as instrument (instrument.key)}
				<button
					id="rtab-{instrument.key}"
					class="nav-item"
					class:active={active === instrument.key}
					role="tab"
					aria-selected={active === instrument.key}
					aria-controls="research-panel"
					tabindex={active === instrument.key ? 0 : -1}
					disabled={!instrument.isReady}
					onclick={() => onselect(instrument.key)}
					{onkeydown}
				>
					<span class="lbl">
						<b>{instrument.name}</b>
						<span class="blurb">{instrument.blurb}</span>
					</span>
					{#if !instrument.isReady}<span class="soon">soon</span>{/if}
				</button>
			{/each}
		</div>
	</section>

	<div class="foot">
		<div class="compute" aria-live="polite">
			<span class="live" class:on={research.running} aria-hidden="true"></span>
			<span class="compute-state">{research.running ? 'running' : 'idle'}</span>
			<span class="track" aria-hidden="true">
				<i style:width={`${Math.round(research.progress * 100)}%`}></i>
			</span>
			{#if cores}<span class="cores tabular">{cores} cores</span>{/if}
		</div>
	</div>
</nav>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		background: var(--panel);
		border-right: 1px solid var(--line);
	}

	.brand {
		display: flex;
		align-items: center;
		padding: var(--sp-6) var(--sp-6) var(--sp-4);
	}

	.brand-name {
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
		color: var(--ink);
	}

	.sec {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-6) var(--sp-5);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		width: 100%;
		text-align: left;
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--ink2);
		cursor: pointer;
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}

	.nav-item:hover:not(:disabled):not(.active) {
		background: var(--panel2);
	}

	.nav-item.active {
		background: var(--panel2);
		border-color: var(--line);
	}

	.nav-item:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.nav-item:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.lbl {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.lbl b {
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		color: var(--ink2);
		letter-spacing: var(--tracking-tight);
	}

	.nav-item.active .lbl b {
		color: var(--ink);
	}

	.blurb {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.soon {
		margin-left: auto;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 2px 6px;
	}

	.foot {
		margin-top: auto;
		padding: var(--sp-4) var(--sp-6);
		border-top: 1px solid var(--line);
	}

	.compute {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.live {
		flex: none;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--ink3);
	}

	.live.on {
		background: var(--accent);
	}

	.compute-state {
		flex: none;
	}

	.track {
		flex: 1;
		min-width: 0;
		height: 4px;
		border-radius: 3px;
		background: var(--panel2);
		border: 1px solid var(--line);
		overflow: hidden;
	}

	.track i {
		display: block;
		height: 100%;
		background: var(--ink3);
		transition: width var(--dur-fast) var(--ease);
	}

	.cores {
		flex: none;
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}
</style>
