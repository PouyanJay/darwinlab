<!--
  The flee assay, on the card.

  A free-running tank cannot be asked anything: the shark goes where it goes, and the fish you happen
  to see meet it are an anecdote. So this stages the question — one fish, one shark, dropped at a
  known bearing — and walks it all the way round. You watch the trials in the tank, and what comes out
  is a compass: which way the fish TURNED, from every direction the shark came from.

  The verdict is a turn and not a flee error, and engine/assay.ts explains at length why: a fish that
  simply swims fast in a straight line collects a beautiful flee error for free, because its own
  displacement rotates the away-vector onto its velocity. Blind brains scored 43° on that and looked
  like expert escapers. A turn cannot be earned by moving. Chance is 50%, exactly, and blind brains
  measure 50%.

  The trials the tank plays and the trials the number comes from are the SAME trials (engine/assay.ts),
  stepped by the same functions. The picture is evidence for the number, not an illustration of it.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Canvas from '../common/Canvas.svelte';
	import Icon from '../common/Icon.svelte';
	import { paintOnChange } from '../common/paintOnChange';
	import { drawAssay } from '$lib/render';
	import { bench, theme } from '$lib/state';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	const running = $derived(bench.assayRunning(entry.id));
	const progress = $derived(bench.assayProgress(entry.id));
	const result = $derived(bench.assayResult(entry.id));

	/** Nothing has been judged yet — there is no brain to question. */
	const hasBrain = $derived(entry.stats.gen > 0);

	/**
	 * Chance is 0.5, and it is not a convention — it is arithmetic. A brain with no information about
	 * where the shark is turns towards escape exactly half the time. Everything above that is what the
	 * senses bought, in the only currency that matters: a decision made correctly.
	 */
	const CHANCE = 0.5;
	const accuracy = $derived(result?.turnAccuracy ?? null);
	const overChance = $derived(accuracy === null ? null : Math.round((accuracy - CHANCE) * 100));

	// The chart only changes when a NEW verdict lands — not 60 times a second.
	const register = (render: () => void) => bench.painters.add(render);
	const paint = paintOnChange(
		() =>
			`${result?.bearings.map((b) => `${b.bearingDeg}:${b.share?.toFixed(3)}`).join('|')}|${theme.name}`,
		(ctx, width, height) => drawAssay(ctx, width, height, result?.bearings ?? [], theme.name)
	);
</script>

<section class="assay">
	<header>
		<span class="field-label">Flee assay</span>
		<span class="blurb">
			drop a shark at every bearing and see which way the best brain turns. A coin gets 50%
		</span>

		{#if running}
			<Button size="sm" onclick={() => bench.stopAssay(entry.id)}>Stop</Button>
		{:else}
			<Button size="sm" disabled={!hasBrain} onclick={() => bench.runAssay(entry.id)}>
				<Icon name="compass" size={13} />
				<span>{result ? 'Run again' : 'Run assay'}</span>
			</Button>
			{#if result}
				<!-- Put the verdict away and collapse the panel back to its button. -->
				<Button
					variant="icon"
					size="sm"
					aria-label="clear the assay result"
					title="clear the result"
					onclick={() => bench.clearAssayResult(entry.id)}
				>
					<Icon name="close" size={14} />
				</Button>
			{/if}
		{/if}
	</header>

	{#if running && progress}
		<!-- The run is HELD while this happens (see bench.runAssay) — asking a question must never cost
		     the experiment a generation. -->
		<!-- What you are watching is the CHAMPION walking the same bearings the population was measured
		     on. The number is the population's; this is the film of one brain doing it. -->
		<p class="progress" role="status">
			Watching the best brain, trial <b class="tabular">{progress.index}</b> of
			<b class="tabular">{progress.total}</b>. The run is held while it answers.
		</p>
	{/if}

	{#if result}
		<!-- The verdict is on screen the moment it is measured — it is taken headlessly, across the whole
		     population, when the button is pressed. The film that plays beside it is the champion
		     demonstrating the same question. Hiding the answer until the film ended would have been
		     showmanship: the number was already known, and pretending otherwise is not an experiment. -->
		<div class="verdict">
			<div class="compass">
				<Canvas
					{paint}
					{register}
					label={accuracy === null
						? 'the assay compass: no bearing produced an answer'
						: `the assay compass: the fish turned towards escape at ${Math.round(accuracy * 100)}% of the bearings it was asked about, out of ${result.asked}`}
				/>
			</div>

			<dl class="figures">
				<div>
					<dt>turned towards escape</dt>
					<dd class="tabular" data-testid="turn-accuracy">
						{accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`}
					</dd>
					{#if overChance !== null}
						<dd class="sub tabular">
							{#if overChance === 0}
								exactly chance
							{:else}
								{Math.abs(overChance)} points {overChance > 0 ? 'above' : 'below'} chance
							{/if}
							· {result.brains} brains, n={result.asked}
						</dd>
					{/if}
				</div>
				<div>
					<dt>escaped</dt>
					<dd class="tabular">{Math.round(result.escapeRate * 100)}%</dd>
					<dd class="sub">across every trial</dd>
				</div>
			</dl>
		</div>
	{/if}
</section>

<style>
	.assay {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-4) var(--sp-5);
		border-top: 1px solid var(--line);
		background: var(--panel2);
		/* its own query container: this card lives at every width from a phone column to a full-width
		   shelf, and only IT knows when its one-line header no longer fits */
		container-type: inline-size;
	}

	header {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.blurb {
		flex: 1;
		min-width: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.progress {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.progress b {
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.verdict {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
	}

	.compass {
		flex: none;
		width: 108px;
		height: 108px;
	}

	.figures {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		gap: var(--sp-6);
		margin: 0;
	}

	.figures dt {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-medium);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.figures dd {
		margin: 2px 0 0;
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}

	.figures .sub {
		font-size: var(--fs-sm);
		font-weight: var(--fw-regular);
		color: var(--ink3);
	}

	/* Squeezed narrow (the workbench's side column, a phone), the header stacks: label and button
	   hold the first line, the blurb takes a full line beneath — never one word per line. AFTER the
	   base rules on purpose: it overrides .blurb's flex-basis at equal specificity. */
	@container (width < 360px) {
		header {
			flex-wrap: wrap;
		}

		.blurb {
			order: 1;
			flex-basis: 100%;
		}

		.verdict {
			flex-wrap: wrap;
		}
	}
</style>
