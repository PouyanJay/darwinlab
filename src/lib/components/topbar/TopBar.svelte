<!--
  The sticky glassy top bar — the app's one set of global controls (README §5.1).

  Left: what this is (mark, wordmark, lab subtitle). Right: what you can do to it (how far evolution
  has got, play/pause, speed, train, theme, and — once they exist — story and add-world).

  It reads and drives the simulation only through the `bench` and `theme` stores, never by touching
  a world (README §7).
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Chip from '../common/Chip.svelte';
	import Segmented from '../common/Segmented.svelte';
	import LogoMark from './LogoMark.svelte';
	import LabSettings from './LabSettings.svelte';
	import TransportIcon from '../common/TransportIcon.svelte';
	import { bench, theme, SPEEDS } from '$lib/state';

	interface Props {
		/** Wired in Phase 8. Until story mode exists, the button simply isn't there. */
		onplaystory?: () => void;
		onaddworld?: () => void;
	}

	let { onplaystory, onaddworld }: Props = $props();

	/** How far a "Train" burst fast-forwards when no max generation is set. */
	const TRAIN_BURST = 25;

	/**
	 * Publish the bar's REAL height as `--topbar-height`.
	 *
	 * The drawer and the turbo pill have to sit clear of the bar, and the bar's height isn't a
	 * constant they can assume: it grows when the controls wrap on a narrow screen. Measuring it and
	 * letting them anchor off the result is the only version of this that cannot go stale.
	 */
	function publishHeight(bar: HTMLElement) {
		const root = document.documentElement;
		const write = () => root.style.setProperty('--topbar-height', `${bar.offsetHeight}px`);

		write();
		const observer = new ResizeObserver(write);
		observer.observe(bar);

		return () => {
			observer.disconnect();
			root.style.removeProperty('--topbar-height'); // back to the token's fallback
		};
	}

	const training = $derived(bench.turboTarget !== null);
	const trainTarget = $derived(bench.maxGenerations || bench.generationsEvolved + TRAIN_BURST);
	const trainLabel = $derived(
		bench.maxGenerations ? `Train to gen ${bench.maxGenerations}` : `Train +${TRAIN_BURST} gens`
	);
</script>

<header {@attach publishHeight}>
	<div class="brand">
		<LogoMark />
		<!-- The page's h1: the bench has real h2s (dialogs, drawers), and a page whose headings
		     start at level two reads as if its top is missing. -->
		<h1 class="wordmark">Darwin Lab</h1>
		<Chip variant="tag">live evolution</Chip>
	</div>

	<span class="divider" aria-hidden="true"></span>

	<div class="lab">
		<span class="lab-name">Lab 01 · Predator &amp; Prey</span>
		<span class="lab-blurb">
			Real neuroevolution — every fish carries a tiny brain that survives, breeds, and mutates.
		</span>
	</div>

	<div class="spacer"></div>

	<p class="readout">
		<span class="glyph" aria-hidden="true">⟳</span>
		<b class="tabular" data-testid="generations">{bench.generationsEvolved}</b>
		<span>generations evolved</span>
	</p>

	<!-- No aria-label on the buttons that carry visible text: an aria-label would REPLACE the label a
	     sighted user reads ("Pause") with a different one AT hears, which is exactly the mismatch
	     WCAG's "label in name" is about. Only the glyph-only buttons below get one. -->
	<Button variant="primary" style="min-width: 94px" onclick={() => bench.togglePlay()}>
		<TransportIcon playing={bench.running} />
		<span>{bench.running ? 'Pause' : 'Evolve'}</span>
	</Button>

	<Segmented
		label="simulation speed"
		options={SPEEDS}
		value={bench.speed}
		onchange={(speed) => bench.setSpeed(speed)}
	/>

	<Button disabled={training} onclick={() => bench.trainTo(trainTarget)}>
		<span aria-hidden="true">⏩</span>
		{trainLabel}
	</Button>

	<Button aria-label="switch theme" onclick={() => theme.toggle()}>
		<span aria-hidden="true">{theme.name === 'light' ? '◐' : '◑'}</span>
	</Button>

	<LabSettings />

	{#if onplaystory || onaddworld}
		<span class="divider" aria-hidden="true"></span>
	{/if}

	{#if onplaystory}
		<Button variant="accent" disabled={training} onclick={onplaystory}>
			<TransportIcon playing={false} size={9} />
			<span>Play story</span>
		</Button>
	{/if}

	{#if onaddworld}
		<Button aria-label="add world" onclick={onaddworld}>+</Button>
	{/if}
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: var(--z-topbar);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-5);
		padding: var(--sp-4) var(--sp-8);
		border-bottom: 1px solid var(--line);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	.wordmark {
		margin: 0; /* an h1 for the outline, not for h1's browser styling */
		font-family: var(--font-display);
		font-size: var(--fs-wordmark);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
	}

	.divider {
		flex: none;
		width: 1px;
		height: 26px;
		background: var(--line);
	}

	.lab {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.lab-name {
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
	}

	.lab-blurb {
		font-size: var(--fs-sm);
		color: var(--ink3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.spacer {
		flex: 1;
	}

	.readout {
		display: flex;
		align-items: center;
		gap: 7px;
		margin: 0;
		padding: var(--sp-2) var(--sp-5);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--panel);
		font-size: var(--fs-md);
		font-weight: var(--fw-medium);
		color: var(--ink2);
	}

	.readout b {
		font-size: 14px;
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.glyph {
		font-size: var(--fs-body);
		color: var(--accent);
	}

	/*
	 * The lab blurb is the first thing to go when the bar runs out of room: it is context, not a
	 * control, and losing it keeps every control on one line for longer. (The full responsive pass
	 * is Phase 9 — this is just the point where the bar would otherwise start wrapping badly.)
	 */
	@media (max-width: 1180px) {
		.lab-blurb {
			display: none;
		}
	}

	@media (max-width: 900px) {
		.lab,
		.divider {
			display: none;
		}
	}
</style>
