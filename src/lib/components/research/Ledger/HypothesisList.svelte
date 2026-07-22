<!--
  The claims you can test, laid out side by side, each showing its latest verdict at a glance. Click one
  to open its verdict card below. A claim carries its own status — supported, refuted, or untested — so
  the row reads as the state of the argument, not just a menu.
-->
<script lang="ts">
	import { ledger } from '$lib/state';
</script>

<section class="claims">
	<span class="eyebrow">Claims · pick one to test</span>
	<div class="hyps" role="group" aria-label="hypotheses">
		{#each ledger.claims as claim (claim.id)}
			{@const latest = ledger.latestFor(claim.id)}
			{@const isActive = ledger.active.id === claim.id}
			<button
				class="hyp"
				class:active={isActive}
				aria-pressed={isActive}
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
</section>

<style>
	.claims {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	/* Side by side across the top; auto-fit reflows to fewer columns (and finally one) as the workspace
	   narrows — keyed off the row's own width, so the rail and sidebar can't crowd it into a mess. */
	.hyps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--sp-3);
	}

	.hyp {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--sp-4);
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
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
		background: var(--data-teal);
	}

	.status-refuted {
		color: var(--danger-ink);
	}

	.status-refuted .dot {
		background: var(--danger);
	}
</style>
