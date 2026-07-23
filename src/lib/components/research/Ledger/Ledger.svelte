<!--
  The Ledger instrument — compose a claim, get a verdict, keep the record.

  Since the composer redesign the workspace holds only EVIDENCE: the honesty tiles (how the settled
  record splits, and what one verdict costs), the active claim's verdict card as the centrepiece,
  and the dated record beneath it. Composing and firing live in the design panel (the console's
  second zone); the drill sidebar opens whichever record row is picked. Everything reads off the
  ledger store; nothing measures here.
-->
<script lang="ts">
	import VerdictCard from './VerdictCard.svelte';
	import RecordFeed from './RecordFeed.svelte';
	import { ledger } from '$lib/state';
	import { formatSignedSeconds } from '$lib/format';

	const tally = $derived(ledger.tally);
	const latest = $derived(ledger.entries[0] ?? null);
</script>

<div class="ledger" data-testid="ledger">
	<!-- The experiment's receipts, always visible above the conclusions — the record survives
	     reload, so the tiles describe the whole notebook, not just this session. -->
	<div class="tiles" data-testid="ledger-tiles">
		<div class="tile">
			<span class="tv">{tally.claims}</span>
			<span class="ts">claims tested</span>
		</div>
		<div class="tile">
			<span class="tv">{ledger.entries.length}</span>
			<span class="ts">records kept · survive reload</span>
		</div>
		<div class="tile">
			<span class="tv">{tally.supported} <span class="tv-dim">·</span> {tally.refuted}</span>
			<span class="ts">supported · refuted</span>
		</div>
		<div class="tile">
			<span class="tv">{ledger.seeds * 2}</span>
			<span class="ts">runs per verdict · {ledger.seeds} × 2 arms</span>
		</div>
		<div class="tile">
			{#if latest}
				<span class="tv" class:helps={latest.delta > 0} class:costs={latest.delta < 0}>
					{formatSignedSeconds(latest.delta)}
				</span>
				<span class="ts">latest verdict · {latest.verdict}</span>
			{:else}
				<span class="tv">—</span>
				<span class="ts">latest verdict · none yet</span>
			{/if}
		</div>
	</div>

	<VerdictCard />
	<RecordFeed />
</div>

<style>
	/* A CONTAINER, so the tiles reflow on the Ledger's OWN width — it sits in a workspace whose
	   width the drill sidebar and design panel both squeeze. */
	.ledger {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		container-type: inline-size;
	}

	/* ---- the honesty tiles: the notebook's receipts in one row ---- */
	.tiles {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--sp-3);
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel);
		padding: var(--sp-3) var(--sp-4);
	}

	.tv {
		font-size: var(--fs-stat);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}

	.tv-dim {
		color: var(--ink3);
		font-weight: var(--fw-medium);
	}

	.tv.helps {
		color: var(--data-teal);
	}

	.tv.costs {
		color: var(--data-coral);
	}

	.ts {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	@container (max-width: 720px) {
		.tiles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@container (max-width: 460px) {
		.tiles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
