<!--
  Champion clones: three ways to put ONE brain in the water, and they are three different experiments.

  ⚠️ WHAT THIS DOES AND DOES NOT DO. It makes the behaviour LEGIBLE: twenty copies of one policy do
  the same thing at the same time, so the rule stops being an average of a smear and becomes something
  you can watch. It does NOT make the numbers better, and the UI must never imply that it does —
  measured over 60 generations and 3 seeds, clones of the best brain scored a flee error of 72.7° in
  the Direction world against the crowd's 70.2°. Cloning the best SURVIVOR is not cloning the best
  FLEER: fitness is seconds survived, and seconds can be bought by keeping your distance rather than
  by turning the right way. That is a finding, not a bug, and it belongs on the record.

    Off        the population, as it evolved — a strategy plus its cloud of mutants.
    Frozen     the real run is HELD; a sealed tank of clones swims in its place. Switch it off and
               the run resumes exactly where it stood. Nothing about it is scored or remembered.
    Live       the run keeps evolving underneath, and the exhibit is re-cloned from the newest
               champion every generation — you watch the strategy sharpen. Still sealed: what you
               are looking at is never the population being selected.

  And, deliberately NOT in the selector, the fourth thing:

    Bottleneck an INTERVENTION. The clones become the population and evolution carries on from them,
               so variation collapses and every fish after it descends from one individual. It is not
               a view and it cannot be switched off — which is exactly why it must not sit in a row of
               toggles that can. It asks first, and the curve marks the generation it struck at.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Chip from '../common/Chip.svelte';
	import Icon from '../common/Icon.svelte';
	import Segmented from '../common/Segmented.svelte';
	import { bench, type ExhibitMode, type WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	const MODES: { value: ExhibitMode; label: string }[] = [
		{ value: 'off', label: 'Off' },
		{ value: 'frozen', label: 'Frozen' },
		{ value: 'live', label: 'Live' }
	];

	const mode = $derived(bench.exhibitMode(entry.id));
	const interventions = $derived(bench.interventionsOf(entry.id));

	/**
	 * Nothing has been JUDGED yet, so there is nothing to clone.
	 *
	 * A brain is only crowned at a generation boundary, so generation 0 has none — and the old test
	 * for this ("any fish with fitness above zero") was worthless, because fitness is seconds survived
	 * and every fish has some a second after a reset. The control now says it is unavailable instead
	 * of silently snapping back to Off, which is what a freshly reset world used to do.
	 */
	const hasChampion = $derived(entry.stats.gen > 0);

	let confirming = $state(false);

	function choose(next: ExhibitMode) {
		bench.setExhibit(entry.id, next);
	}

	function bottleneck() {
		bench.bottleneckWorld(entry.id);
		confirming = false;
	}
</script>

<div class="exhibit">
	<div class="row">
		<span class="field-label" aria-hidden="true">Champion clones</span>

		<Segmented
			label="champion clones"
			options={MODES}
			value={mode}
			disabled={!hasChampion}
			onchange={(next) => choose(next)}
		/>

		<!-- The intervention sits APART from the toggles, behind its own confirmation, because it is
		     the one control here that cannot be switched back off. -->
		<Button
			variant="icon"
			size="sm"
			tone="danger"
			disabled={!hasChampion || confirming}
			aria-label="clonal bottleneck"
			title="clonal bottleneck — replace the population with copies of the champion, permanently"
			onclick={() => (confirming = true)}
		>
			<Icon name="bottleneck" size={15} />
		</Button>
	</div>

	{#if !hasChampion}
		<p class="waiting">
			Nothing has been judged yet — a brain is crowned at the end of a generation. The clones will
			be available as soon as this world finishes its first one.
		</p>
	{/if}

	{#if mode !== 'off'}
		<!-- The banner is not decoration. A tank full of identical fish that is NOT the population
		     being scored is the single most misreadable thing this product can put on screen, so it
		     says what it is, every second it is up. -->
		<p class="banner" class:live={mode === 'live'} role="status" data-testid="exhibit-banner">
			<Chip tone="accent" style="--chip-accent: {entry.config.accent}">exhibit</Chip>
			{#if mode === 'frozen'}
				<span>
					{entry.config.prey} copies of the
					<b>best brain of the last generation</b> — one policy, repeated, so its rule is something
					you can watch instead of an average of a smear. <b>The run is held</b>: nothing here
					breeds or is scored, and the numbers below are the real run, exactly as you left it.
				</span>
			{:else}
				<span>
					{entry.config.prey} copies of the
					<b>best brain of the last generation</b>, re-cloned every generation. The run below keeps
					evolving; this tank is never the population being selected.
				</span>
			{/if}
		</p>
	{/if}

	{#if confirming}
		<div class="danger">
			<p class="warn" role="alert">
				<b>This changes the run.</b> Every fish becomes a copy of the champion and evolution carries on
				from there: variation collapses to nothing, and everything after descends from one individual.
				It cannot be undone, and the curve will carry a mark at this generation.
			</p>
			<div class="confirm">
				<Button size="sm" onclick={() => (confirming = false)}>Cancel</Button>
				<Button variant="primary" size="sm" onclick={bottleneck}>Bottleneck the run</Button>
			</div>
		</div>
	{/if}

	{#if interventions.length && !confirming}
		<!-- The run carries its history on its face, for as long as it lives. -->
		<p class="marked">
			<Chip tone="accent" style="--chip-accent: {entry.config.accent}">
				bottlenecked · gen {interventions.join(', ')}
			</Chip>
			<span>every fish since descends from one individual</span>
		</p>
	{/if}
</div>

<style>
	.exhibit {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin: var(--sp-4) var(--sp-5) 0;
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-input);
		background: var(--panel2);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.waiting {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.banner {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-3);
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink2);
		animation: fade-up var(--dur-fast) var(--ease) both;
	}

	.banner b {
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.danger {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.marked {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.warn {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--danger-ink); /* danger AS TEXT — see tokens.css */
	}

	.warn b {
		font-weight: var(--fw-bold);
	}

	.confirm {
		display: flex;
		gap: var(--sp-2);
		margin-left: auto;
	}
</style>
