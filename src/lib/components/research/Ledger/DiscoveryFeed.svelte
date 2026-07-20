<!--
  The record — every verdict this lab has settled, newest first, kept across reloads. Each line is a
  dated, reproducible finding: what was claimed, how it came out, the effect, and the config
  fingerprint that reruns it. This is the thing the Ledger exists to produce.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import { ledger } from '$lib/state';

	function exportLedger() {
		const blob = new Blob([ledger.toJson()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'darwin-lab-ledger.json';
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

{#if ledger.entries.length}
	<div class="feed" data-testid="discovery-feed">
		<div class="head">
			<span class="eyebrow">Discoveries · {ledger.entries.length} recorded</span>
			<div class="head-actions">
				<Button size="sm" variant="ghost" onclick={exportLedger}>Export JSON</Button>
				<Button size="sm" variant="ghost" onclick={() => ledger.clear()}>Clear</Button>
			</div>
		</div>
		<ul>
			{#each ledger.entries as entry (entry.id)}
				<li>
					<time>{entry.recorded ? entry.recorded.slice(0, 10) : '—'}</time>
					<span class="text">{entry.text}</span>
					<span class="verdict verdict-{entry.verdict}">{entry.verdict}</span>
					<span class="delta tabular">Δ{entry.delta > 0 ? '+' : ''}{entry.delta.toFixed(1)}s</span>
					<span class="hash tabular" title="config fingerprint — reruns this experiment"
						>{entry.configHash}</span
					>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		border-top: 1px solid var(--line);
		padding-top: var(--sp-4);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.head-actions {
		display: flex;
		gap: var(--sp-2);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	li {
		display: grid;
		grid-template-columns: 84px 1fr auto auto 60px;
		align-items: baseline;
		gap: var(--sp-3);
		padding: var(--sp-2) 0;
		border-bottom: 1px solid var(--line2);
		font-size: var(--fs-sm);
	}

	li:last-child {
		border-bottom: none;
	}

	time {
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
		font-size: var(--fs-xs);
	}

	.text {
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.verdict {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.verdict-supported {
		color: var(--ink2);
	}

	.verdict-refuted {
		color: var(--danger-ink);
	}

	.delta {
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
	}

	.hash {
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
</style>
