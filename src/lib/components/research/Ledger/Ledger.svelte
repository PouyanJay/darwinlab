<!--
  The Ledger instrument — state a claim, get a verdict, keep the record.

  The claims sit on the left with their latest status; the active one's verdict card is on the right;
  and the dated record of everything settled runs beneath. Everything reads off the ledger store;
  nothing measures here.
-->
<script lang="ts">
	import HypothesisList from './HypothesisList.svelte';
	import VerdictCard from './VerdictCard.svelte';
	import DiscoveryFeed from './DiscoveryFeed.svelte';
</script>

<div class="ledger" data-testid="ledger">
	<div class="top">
		<HypothesisList />
		<VerdictCard />
	</div>
	<DiscoveryFeed />
</div>

<style>
	.ledger {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}

	.top {
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
		gap: var(--sp-4);
		align-items: start;
	}

	@media (max-width: 720px) {
		.top {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
