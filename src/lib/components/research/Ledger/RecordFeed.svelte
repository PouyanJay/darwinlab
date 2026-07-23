<!--
  The record — every verdict this lab has settled, newest first, kept across reloads. Each row is a
  dated, reproducible finding: what was claimed, how it came out, the effect, and the config
  fingerprint that reruns it. Rows are buttons: clicking one opens its provenance in the drill
  sidebar. REFUTED STAYS FOREVER — with the composer's wide claim space, the feed is the
  anti-fishing device: reruns are all here, dated, either verdict.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import { ledger } from '$lib/state';
	import { downloadText } from '$lib/download';
	import { formatSignedSeconds } from '$lib/format';

	function exportLedger() {
		downloadText('darwin-lab-ledger.json', ledger.toJson(), 'application/json');
	}
</script>

<section class="feed" data-testid="record-feed">
	<header class="head">
		<div class="head-titles">
			<span class="eyebrow">The record · {ledger.entries.length} settled</span>
			<span class="meta">persisted · click a row to open its provenance</span>
		</div>
		{#if ledger.entries.length}
			<div class="head-actions">
				<Button size="sm" variant="ghost" onclick={exportLedger}>Export JSON</Button>
				<Button size="sm" variant="ghost" onclick={() => ledger.clear()}>Clear</Button>
			</div>
		{/if}
	</header>

	{#if ledger.entries.length}
		<div class="rows" role="listbox" aria-label="the record">
			{#each ledger.entries as entry (entry.id)}
				<button
					class="row"
					class:sel={ledger.selected?.id === entry.id}
					role="option"
					aria-selected={ledger.selected?.id === entry.id}
					onclick={() => ledger.select(entry.id)}
				>
					<time class="tabular">{entry.recorded ? entry.recorded.slice(0, 10) : '—'}</time>
					<span class="verdict verdict-{entry.verdict}">
						<span class="vdot" aria-hidden="true"></span>
						{entry.verdict}
					</span>
					<span class="text">{entry.text}</span>
					<span class="delta tabular">Δ{formatSignedSeconds(entry.delta)}</span>
					<span class="hash tabular" title="config fingerprint — reruns this experiment"
						>{entry.configHash}</span
					>
				</button>
			{/each}
		</div>
		<p class="read">
			<b>Refuted stays forever.</b> The record keeps every run, either verdict — you cannot quietly rerun
			until something turns green, because the reruns are all here, dated and fingerprinted.
		</p>
	{:else}
		<p class="read">No verdicts yet — compose a claim in the design panel and test it.</p>
	{/if}
</section>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-5) var(--sp-6);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.head-titles {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.meta {
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	.head-actions {
		display: flex;
		gap: var(--sp-2);
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.row {
		display: grid;
		grid-template-columns: 84px 92px minmax(0, 1fr) auto 60px;
		align-items: baseline;
		gap: var(--sp-3);
		padding: var(--sp-2) var(--sp-2);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		text-align: left;
		font-family: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
	}

	.row:hover {
		background: var(--chip);
	}

	.row:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	/* The drilled row — the same full-ink hairline the run grid's selected cell wears. */
	.row.sel {
		background: var(--panel2);
		border-color: var(--line);
		box-shadow: inset 0 0 0 1px var(--ink);
	}

	time {
		color: var(--ink3);
		font-size: var(--fs-xs);
	}

	.verdict {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.vdot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex: none;
		background: var(--ink3);
	}

	.verdict-supported {
		color: var(--ink2);
	}

	.verdict-supported .vdot {
		background: var(--data-teal);
	}

	.verdict-refuted {
		color: var(--danger-ink);
	}

	.verdict-refuted .vdot {
		background: var(--danger);
	}

	.text {
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.delta {
		color: var(--ink2);
	}

	.hash {
		color: var(--ink3);
		text-align: right;
	}

	.read {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.read b {
		color: var(--ink2);
	}
</style>
