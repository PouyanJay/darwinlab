<!--
  The evaluation panel — where the card stops showing a run and starts reporting a RESULT.

  The tank above it is one population on one seed: it wanders several points between seeds, and a
  ladder read off five of those is a ladder read off noise. This measures the environment as
  configured on N INDEPENDENT SEEDS, freezes each evolved population so nothing evolves while it is
  being judged, and states the mean, the error bar, and the n.

  It also states when it is STALE. Change a condition and the result stops being an answer to the
  question you are now asking, so it is struck through rather than left on screen going quietly
  wrong — a number that no longer matches its configuration is worse than no number.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import { evals } from '$lib/state';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	const cfg = $derived(entry.world.cfg);
	// `entry.config` is the REACTIVE mirror; touching it here is what makes this panel re-evaluate
	// its staleness when a condition changes (the raw world would never wake it).
	const configVersion = $derived(JSON.stringify(entry.config.senses) + entry.config.preds);
	// The HELD result, not only the still-valid one: a result whose config has moved must be shown
	// struck through and labelled, never silently replaced by an empty "Evaluate" button as if it had
	// never been measured. `configVersion` is touched so this re-derives when a condition changes —
	// the raw world it reads from is $state.raw and would never wake it.
	const result = $derived(configVersion ? evals.held(entry.id) : null);
	const stale = $derived(configVersion ? evals.isStale(entry.id, cfg) : false);
	const busy = $derived(evals.running === entry.id);

	const pct = (value: number) => `${Math.round(value * 100)}%`;
</script>

<section class="eval" aria-label="evaluation of {entry.config.name}">
	<header>
		<span class="eyebrow">evaluation</span>
		{#if result}
			<span class="n tabular">n = {result.n} seeds · {result.episodes} episodes</span>
		{/if}
	</header>

	{#if busy}
		<div class="running">
			<div class="bar"><div class="fill" style:width="{evals.progress * 100}%"></div></div>
			<span class="tabular">{Math.round(evals.progress * 100)}%</span>
			<Button size="sm" variant="ghost" onclick={() => evals.cancel()}>Cancel</Button>
		</div>
	{:else if result}
		<div class="headline" class:stale>
			<b class="tabular" data-testid="eval-return">{result.meanReturn.toFixed(2)}s</b>
			<span class="sd tabular">± {result.sdReturn.toFixed(2)}</span>
			<span class="what">mean return per agent</span>
		</div>

		<!-- HOW they survived, not just how long. These are the claims a reader can check against
		     the tank with their own eyes: are they fleeing the right way, do the strikes miss? -->
		<dl class="metrics">
			<div>
				<dt>flee error</dt>
				<dd class="tabular">{result.behavior.fleeAngleErrorDeg.toFixed(0)}°</dd>
			</div>
			<div>
				<dt>strikes dodged</dt>
				<dd class="tabular">{pct(result.behavior.dodgeRate)}</dd>
			</div>
			<div>
				<dt>time cornered</dt>
				<dd class="tabular">{pct(result.behavior.cornerTimeShare)}</dd>
			</div>
			<div>
				<dt>distance kept</dt>
				<dd class="tabular">{result.behavior.meanPredDistance.toFixed(0)}px</dd>
			</div>
		</dl>

		{#if stale}
			<p class="warn" data-testid="eval-stale">
				The configuration changed since this was measured, so it is no longer an answer to the
				question you are now asking. <button onclick={() => evals.run(entry.id, cfg)}>
					Re-evaluate
				</button>
			</p>
		{/if}
	{:else}
		<p class="empty">
			The tank is one population on one seed. Evaluate to replicate this environment across
			independent seeds and report a mean with an error bar.
		</p>
		<Button size="sm" onclick={() => evals.run(entry.id, cfg)} data-testid="evaluate">
			Evaluate
		</Button>
	{/if}
</section>

<style>
	.eval {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-4) var(--sp-5) var(--sp-5);
		border-top: 1px solid var(--line);
		background: var(--panel2);
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink3);
	}

	.n {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	.headline {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
	}

	.headline b {
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}

	/* A result measured at a configuration that no longer exists is not a result. */
	.headline.stale {
		opacity: 0.55;
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}

	.sd {
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.what {
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--sp-3);
		margin: 0;
	}

	.metrics dt {
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	.metrics dd {
		margin: 1px 0 0;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}

	.empty {
		margin: 0;
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	.warn {
		margin: 0;
		font-size: var(--fs-label);
		color: var(--danger-ink);
	}

	.warn button {
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		color: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.running {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		font-size: var(--fs-label);
		color: var(--ink2);
	}

	.bar {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--line);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--accent);
		transition: width var(--dur-fast) linear;
	}

	@media (max-width: 560px) {
		.metrics {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
