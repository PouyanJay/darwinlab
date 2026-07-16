<!--
  One sense, on or off — and clicking it is a real ablation, not a display setting.
  Off means that input neuron is fed 0 for the rest of the world's life, so the population has to
  evolve without it. That is why the pill looks the way it does: filled and solid when the sense is
  wired in, hollow and dashed when the input has been cut. NEUTRAL, not accent-tinted: the node's
  chrome stays grey whatever the world's accent is — the accent belongs to the graphs and stats.

  It is a toggle button (aria-pressed), so a screen-reader user hears "dist, pressed" and knows the
  neuron is live — the fill is not the only place that information exists.
-->
<script lang="ts">
	interface Props {
		/** The cramped label on the pill: "dist", "dir", "close", "walls". */
		label: string;
		/** The full name, used to say what the click will do: "cut direction input neuron". */
		name: string;
		on: boolean;
		onclick: () => void;
	}

	let { label, name, on, onclick }: Props = $props();

	const title = $derived(`${on ? 'cut' : 'grow'} ${name.toLowerCase()} input neuron`);
</script>

<button type="button" class="pill" class:on aria-pressed={on} {title} {onclick}>
	{label}
</button>

<style>
	.pill {
		padding: 3.5px var(--sp-3);
		border: 1px dashed var(--line);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink3);
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	.pill:hover {
		border-color: var(--ink3);
		color: var(--ink);
	}

	/* Wired in: a solid grey fill against the dashed hollow of a cut sense — state by form, no hue. */
	.on {
		border-style: solid;
		border-color: var(--line);
		background: var(--chip);
		color: var(--ink);
	}

	/* A dense pill row cannot take a full 44px without its targets overlapping — mis-taps are
	   worse than small targets — so on touch the pills grow to a comfortable middle instead. */
	@media (pointer: coarse) {
		.pill {
			padding: 9px var(--sp-4);
		}
	}
</style>
