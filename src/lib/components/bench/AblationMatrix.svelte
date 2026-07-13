<!--
  The ablation matrix — what each observation channel is actually WORTH.

  The bench's five environments are CUMULATIVE (each adds a channel to the one before), and that
  hides the individual verdicts: an environment carrying a channel that pays and one that taxes
  reports their sum, so neither shows. This runs the SUBSETS directly — every combination on equal
  budgets, on the same seeds, in the same environment — and prints what each one is worth against
  the blind policy.

  It is the panel that settles arguments, and it is the reason the bench's own ladder is ordered the
  way it is: the order was read off this table, not chosen.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import { evaluate } from '$lib/lab/evaluator';
	import { bench } from '$lib/state';
	import type { Senses, WorldConfig } from '$lib/engine';

	/** The subsets worth asking about. Each is a policy that receives exactly these channels. */
	const SUBSETS: { label: string; senses: Senses }[] = [
		{ label: 'blind', senses: { dist: false, dir: false, closing: false, walls: false } },
		{ label: 'range', senses: { dist: true, dir: false, closing: false, walls: false } },
		{ label: 'bearing', senses: { dist: false, dir: true, closing: false, walls: false } },
		{ label: 'range + bearing', senses: { dist: true, dir: true, closing: false, walls: false } },
		{
			label: '+ boundary rays',
			senses: { dist: true, dir: true, closing: false, walls: true }
		},
		{ label: 'all four', senses: { dist: true, dir: true, closing: true, walls: true } }
	];

	interface Row {
		label: string;
		mean: number;
		sd: number;
		vsBlind: number;
	}

	let rows = $state<Row[]>([]);
	let running = $state(false);
	let progress = $state(0);
	let controller: AbortController | null = null;

	/** Seeds and episodes: enough for a real error bar without asking the reader to wait forever. */
	const SEEDS = 3;
	const EPISODES = 20;

	async function run() {
		if (running) return;
		const base = bench.worlds[0]?.world.cfg;
		if (!base) return;

		running = true;
		rows = [];
		progress = 0;
		controller = new AbortController();
		const signal = controller.signal;

		let blindMean = 0;
		for (const [index, subset] of SUBSETS.entries()) {
			const cfg: WorldConfig = { ...structuredClone(base), senses: { ...subset.senses } };
			const result = await evaluate(
				{ cfg, seeds: SEEDS, episodes: EPISODES },
				{
					signal,
					onProgress: (fraction) => (progress = (index + fraction) / SUBSETS.length)
				}
			);
			if (!result || signal.aborted) {
				running = false;
				return;
			}
			if (index === 0) blindMean = result.meanReturn;
			rows = [
				...rows,
				{
					label: subset.label,
					mean: result.meanReturn,
					sd: result.sdReturn,
					// what this subset is worth OVER BLINDNESS — the only comparison that answers
					// "does knowing pay", which comparing against random policies never did
					vsBlind: blindMean ? (result.meanReturn / blindMean - 1) * 100 : 0
				}
			];
		}

		running = false;
		progress = 0;
	}

	function cancel() {
		controller?.abort();
		running = false;
		progress = 0;
	}
</script>

<section class="matrix" aria-label="ablation matrix">
	<header>
		<div>
			<h2>Ablation matrix</h2>
			<p>
				What each observation channel is worth, measured directly. The bench's environments are
				cumulative, so a channel that pays and one that taxes report their sum and neither shows.
				Every row here is the same environment with a different observation space — equal budgets,
				equal seeds — scored against the blind policy.
			</p>
		</div>
		{#if running}
			<Button size="sm" variant="ghost" onclick={cancel}>Cancel</Button>
		{:else}
			<Button size="sm" onclick={run} data-testid="run-ablation">
				{rows.length ? 'Re-run' : `Run (${SUBSETS.length} × ${SEEDS} seeds)`}
			</Button>
		{/if}
	</header>

	{#if running}
		<div class="bar"><div class="fill" style:width="{progress * 100}%"></div></div>
	{/if}

	{#if rows.length}
		<table>
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
		<p class="footnote">
			n = {SEEDS} seeds × {EPISODES} episodes per row, populations frozen while scored. A channel that
			pays does so because this environment holds a hazard only it can solve; one that taxes is noise
			the policy has to overcome.
		</p>
	{/if}
</section>

<style>
	.matrix {
		padding: var(--sp-5) var(--sp-6);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel);
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-5);
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
	}

	header p {
		margin: var(--sp-2) 0 0;
		max-width: 68ch;
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	table {
		width: 100%;
		margin-top: var(--sp-5);
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}

	th,
	td {
		padding: 7px 10px;
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

	.footnote {
		margin: var(--sp-3) 0 0;
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	.bar {
		height: 4px;
		margin-top: var(--sp-4);
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
