<!--
  A thin horizontal bar showing how much of something there is.

  Two anchors, because the inspector needs both: most quantities fill from the left (a distance, a
  thrust), but a turn is bidirectional and has to grow out from the CENTRE — left of the tick means
  the fish is turning left. Without the centre tick, "barely turning left" and "going straight
  ahead" would look the same.

  Display only. The number it represents is always written out next to it in text as well, because
  a bar's length is not a value anyone can read.
-->
<script lang="ts">
	interface Props {
		/** 0–1 for a left-anchored meter; −1…1 for a centred one. Clamped either way. */
		value: number;
		/**
		 * Where the fill grows FROM. Not called `anchor`: that is one of Svelte's own mount options,
		 * and a prop of that name collides with it — the component cannot even be mounted in a test.
		 */
		origin?: 'left' | 'centre';
		tone?: 'accent' | 'danger';
	}

	let { value, origin = 'left', tone = 'accent' }: Props = $props();

	const clamped = $derived(Math.max(origin === 'centre' ? -1 : 0, Math.min(1, value)));
	// A centred meter owns half the track per side, so full deflection is 50% of it.
	const width = $derived(origin === 'centre' ? Math.abs(clamped) * 50 : clamped * 100);
	const offset = $derived(clamped >= 0 ? 50 : 50 + clamped * 50);
</script>

<div class="track">
	{#if origin === 'centre'}
		<span class="tick" aria-hidden="true"></span>
		<div
			class="fill centred"
			class:danger={tone === 'danger'}
			style:left="{offset}%"
			style:width="{width}%"
		></div>
	{:else}
		<div class="fill" class:danger={tone === 'danger'} style:width="{width}%"></div>
	{/if}
</div>

<style>
	.track {
		position: relative;
		height: 5px;
		border-radius: 3px;
		background: var(--chip);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: 3px;
		background: var(--accent);
	}

	.centred {
		position: absolute;
	}

	.danger {
		background: var(--danger);
	}

	.tick {
		position: absolute;
		left: 50%;
		top: 0;
		z-index: 1;
		width: 1px;
		height: 100%;
		background: var(--ink3);
	}
</style>
