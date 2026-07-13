<!--
  The ablation matrix — what each observation channel is worth IN THIS ENVIRONMENT.

  It belongs on the card, and that is not a layout preference. A channel is worth exactly what its
  own environment makes it worth: boundary rays pay in a world with no free wall-avoidance and are
  worthless in one that has it; bearing pays when the adversary is slow enough to escape and buys
  nothing when it is not. A single matrix run against some other card's conditions answers a
  question nobody asked — which is what the first cut of this did, and why it is per-card now.

  Every row is THIS card's conditions — its adversaries, its speeds, its tank — with a different
  observation space. Only the observation space varies, which is what makes it an ablation.

  It stales on the CONDITIONS, not on the pills: the matrix varies the senses itself, so toggling a
  pill cannot invalidate it, but changing the adversaries or the speeds can and does.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import { evals } from '$lib/state';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	let open = $state(false);

	const cfg = $derived(entry.world.cfg);
	// Touch the REACTIVE mirror so staleness re-derives when a condition changes: the raw world is
	// $state.raw and would never wake this.
	const version = $derived(
		`${entry.config.preds}·${entry.config.predSpeed}·${entry.config.prey}·${entry.config.vision}·${entry.config.persistence}`
	);
	const rows = $derived(version ? evals.heldAblation(entry.id) : null);
	const stale = $derived(version ? evals.isAblationStale(entry.id, cfg) : false);
	const busy = $derived(evals.ablating === entry.id);
</script>

<section class="ablation" aria-label="ablation matrix for {entry.config.name}">
	<!-- An explicit label: the visible text mentions the environment, and a role-name lookup for
	     "Conditions" (the dialog's button, right above) would otherwise match this too. -->
	<button
		class="head"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-label="ablation matrix"
	>
		<span class="eyebrow">ablation matrix</span>
		<span class="sub">what each channel is worth, in this environment</span>
		<span class="chevron" aria-hidden="true">{open ? '−' : '+'}</span>
	</button>

	{#if open}
		<div class="body">
			{#if busy}
				<div class="running">
					<div class="bar">
						<div class="fill" style:width="{evals.ablationProgress * 100}%"></div>
					</div>
					<span class="tabular">{Math.round(evals.ablationProgress * 100)}%</span>
					<Button size="sm" variant="ghost" onclick={() => evals.cancelAblation()}>Cancel</Button>
				</div>
			{/if}

			{#if rows?.length}
				<table class:stale>
					<thead>
						<tr>
							<th>observation space</th>
							<th class="n">mean return</th>
							<th class="n">± sd</th>
							<th class="n">vs blind</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.label)}
							<tr>
								<td>{row.label}</td>
								<td class="n tabular">{row.mean.toFixed(2)}s</td>
								<td class="n tabular muted">{row.sd.toFixed(2)}</td>
								<td class="n tabular" class:pays={row.vsBlind > 2} class:taxes={row.vsBlind < -2}>
									{row.vsBlind > 0 ? '+' : ''}{row.vsBlind.toFixed(0)}%
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if stale}
					<p class="warn" data-testid="ablation-stale">
						The conditions changed since this was measured — a channel is worth what ITS environment
						makes it worth, so these numbers no longer describe this one.
					</p>
				{/if}
			{:else if !busy}
				<p class="empty">
					Runs this environment's own conditions with one observation space after another, and
					reports what each is worth against the blind policy. The card's own pills stay as they
					are.
				</p>
			{/if}

			{#if !busy}
				<Button size="sm" onclick={() => evals.ablate(entry.id, cfg)} data-testid="run-ablation">
					{rows?.length ? 'Re-run' : 'Run ablation'}
				</Button>
			{/if}
		</div>
	{/if}
</section>

<style>
	.ablation {
		border-top: 1px solid var(--line);
		background: var(--panel2);
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-3);
		width: 100%;
		padding: var(--sp-4) var(--sp-5);
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink3);
	}

	.sub {
		flex: 1;
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	.chevron {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--ink3);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: 0 var(--sp-5) var(--sp-5);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}

	/* Numbers measured in conditions that no longer exist are not an answer to anything. */
	table.stale {
		opacity: 0.55;
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}

	th,
	td {
		padding: 5px 8px;
		border-bottom: 1px solid var(--line);
		text-align: left;
	}

	th {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink3);
	}

	.n {
		text-align: right;
	}

	.muted {
		color: var(--ink3);
	}

	/* A channel earns its keep, or it does not. Both are findings; both are said. */
	.pays {
		color: var(--accentink);
		font-weight: var(--fw-semibold);
	}

	.taxes {
		color: var(--danger-ink);
	}

	.empty,
	.warn {
		margin: 0;
		font-size: var(--fs-label);
	}

	.empty {
		color: var(--ink3);
	}

	.warn {
		color: var(--danger-ink);
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
</style>
