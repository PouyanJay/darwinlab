<!--
  The lab's top-level mode switch: Studio ⇄ Research.

  It sits in the top bar because a MODE is identity — "which instrument the lab is presenting right
  now" — not a bench control (those live in the sidebar). It is the one frame that persists across
  both modes, so it is what tells you that switching is a change of lens, not a change of app.

  A segmented radio group, so it inherits the keyboard behaviour and the single-choice semantics the
  rest of the lab's segmented controls have.
-->
<script lang="ts">
	import Segmented from '../common/Segmented.svelte';
	import { app, type AppMode } from '$lib/state';

	const MODES: { value: AppMode; label: string }[] = [
		{ value: 'studio', label: 'Studio' },
		{ value: 'research', label: 'Research' }
	];
</script>

<Segmented
	label="lab mode"
	options={MODES}
	value={app.mode}
	onchange={(mode) => app.setMode(mode)}
/>
