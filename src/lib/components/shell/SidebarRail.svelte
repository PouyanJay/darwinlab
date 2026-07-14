<!--
  The rail: what the sidebar leaves behind when it is shut.

  A collapse that hides play/pause is a collapse nobody uses twice — mid-experiment you are pausing,
  changing speed and firing training bursts constantly. So the rail keeps every RUN control (as
  icons, each with a real label) and drops only the reading matter.

  The one control that changes shape is speed: a three-way segmented control does not fit 56px, so
  the rail offers the same three values as a CYCLE — press to step ½× → 1× → 2× → ½×. It shows the
  value it is on, so it reads as much as it acts.

  It is inert while the panel is open: on a phone it sits under the panel's scrim, and either way the
  same controls must not be offered to a screen reader twice.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import TransportIcon from '../common/TransportIcon.svelte';
	import { trainTarget, trainLabel } from './train';
	import { bench, shell, SPEEDS } from '$lib/state';

	interface Props {
		onaddworld: () => void;
		onplaystory: () => void;
	}

	let { onaddworld, onplaystory }: Props = $props();

	const training = $derived(bench.turboTarget !== null);
	const speed = $derived(SPEEDS.find((option) => option.value === bench.speed) ?? SPEEDS[1]);
	const train = $derived(trainLabel(bench.maxGenerations));

	function cycleSpeed() {
		const next = (SPEEDS.findIndex((option) => option.value === bench.speed) + 1) % SPEEDS.length;
		bench.setSpeed(SPEEDS[next].value);
	}
</script>

<div class="rail" inert={shell.open}>
	<Button
		variant="icon"
		aria-label="expand the controls"
		aria-expanded={shell.open}
		title="expand the controls"
		onclick={() => shell.toggle()}
	>
		<span aria-hidden="true">»</span>
	</Button>

	{#if !shell.open}
		<span class="divider" aria-hidden="true"></span>

		<Button
			variant="icon"
			aria-label={bench.running ? 'Pause' : 'Evolve'}
			title={bench.running ? 'pause' : 'evolve'}
			onclick={() => bench.togglePlay()}
		>
			<TransportIcon playing={bench.running} />
		</Button>

		<Button
			variant="icon"
			class="speed tabular"
			aria-label="simulation speed — {speed.label}, press to change"
			title="speed — {speed.label}"
			onclick={cycleSpeed}
		>
			{speed.label}
		</Button>

		<Button
			variant="icon"
			aria-label={train}
			title={train}
			disabled={training}
			onclick={() => bench.trainTo(trainTarget(bench.generationsEvolved, bench.maxGenerations))}
		>
			<span aria-hidden="true">⏩</span>
		</Button>

		<span class="divider" aria-hidden="true"></span>

		<Button variant="icon" aria-label="Add environment" title="add environment" onclick={onaddworld}>
			<span aria-hidden="true">＋</span>
		</Button>

		<Button
			variant="icon"
			class="story"
			aria-label="Play story"
			title="play story"
			disabled={training}
			onclick={onplaystory}
		>
			<TransportIcon playing={false} size={9} />
		</Button>
	{/if}
</div>

<style>
	.rail {
		position: sticky;
		top: var(--topbar-height);
		z-index: var(--z-sidebar);
		flex: none;
		align-self: flex-start;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-2);
		width: var(--rail-width);
		height: calc(100vh - var(--topbar-height));
		padding: var(--sp-4) 0;
		border-right: 1px solid var(--line);
		background: var(--panel2);
	}

	.divider {
		width: 20px;
		height: 1px;
		margin: var(--sp-2) 0;
		background: var(--line);
	}

	.rail :global(.speed) {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}

	.rail :global(.story) {
		color: var(--accent);
	}
</style>
