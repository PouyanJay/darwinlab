<!--
  The claims you can test, each showing its latest verdict at a glance. Click one to open its verdict
  card. A claim carries its own status — supported, refuted, or untested — so the list reads as the
  state of the argument, not just a menu.
-->
<script lang="ts">
	import { ledger } from '$lib/state';
</script>

<div class="hyps" role="group" aria-label="hypotheses">
	{#each ledger.claims as claim (claim.id)}
		{@const latest = ledger.latestFor(claim.id)}
		<button
			class="hyp"
			class:active={ledger.active.id === claim.id}
			aria-pressed={ledger.active.id === claim.id}
			onclick={() => ledger.select(claim.id)}
		>
			<span class="claim">{claim.text}</span>
			<span class="status status-{latest?.verdict ?? 'untested'}">
				<span class="dot" aria-hidden="true"></span>
				{#if latest}
					{latest.verdict === 'supported' ? 'Supported' : 'Refuted'} · Δ{latest.delta > 0
						? '+'
						: ''}{latest.delta.toFixed(1)}s
				{:else}
					Untested
				{/if}
			</span>
		</button>
	{/each}
</div>

<style>
	.hyps {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.hyp {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-input);
		background: var(--panel);
		text-align: left;
		cursor: pointer;
		transition: border-color var(--dur-fast) var(--ease);
	}

	.hyp:hover {
		border-color: var(--ink3);
	}

	.hyp.active {
		border-color: var(--ink);
		box-shadow: 0 0 0 1px var(--ink);
	}

	.hyp:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.claim {
		font-size: var(--fs-sm);
		line-height: 1.4;
		color: var(--ink);
	}

	.status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
		color: var(--ink3);
	}

	.status .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--ink3);
		flex: none;
	}

	.status-supported {
		color: var(--ink);
	}

	.status-supported .dot {
		background: var(--ink);
	}

	.status-refuted {
		color: var(--danger-ink);
	}

	.status-refuted .dot {
		background: var(--danger);
	}
</style>
