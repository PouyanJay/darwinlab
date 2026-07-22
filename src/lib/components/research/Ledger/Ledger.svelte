<!--
  The Ledger instrument — state a claim, get a verdict, keep the record.

  Read top to bottom: the claims sit side by side across the top, each with its latest status; below
  them the active claim's verdict card runs full width as the centrepiece; and the dated record of
  everything settled runs beneath that. Everything reads off the ledger store; nothing measures here.
-->
<script lang="ts">
	import HypothesisList from './HypothesisList.svelte';
	import VerdictCard from './VerdictCard.svelte';
	import DiscoveryFeed from './DiscoveryFeed.svelte';
</script>

<div class="ledger" data-testid="ledger">
	<HypothesisList />
	<VerdictCard />
	<DiscoveryFeed />
</div>

<style>
	.ledger {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}
</style>
