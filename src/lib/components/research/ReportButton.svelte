<!--
  The "add to report" control shared by every sidebar summary.

  One button, two states: it invites the conclusion into the notebook, then reads "in report" once it
  is there — and stays clickable, so re-running the instrument and pressing again UPDATES the finding
  (the store dedupes on the same source + subject). Monochrome: it is chrome, not data.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Icon from '../common/Icon.svelte';

	let { inReport, onadd }: { inReport: boolean; onadd: () => void } = $props();
</script>

<!--
  Not a toggle: pressing it while "in report" re-adds the latest run (the store dedupes on source +
  subject), it never removes — so the state rides on the label and icon, not `aria-pressed`.
-->
<Button size="sm" onclick={onadd} data-testid="add-to-report">
	<Icon name={inReport ? 'check' : 'plus'} size={13} />
	<span>{inReport ? 'In report' : 'Add to report'}</span>
</Button>
