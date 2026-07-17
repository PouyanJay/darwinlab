<!--
  The welcome screen — the product's finding, stated full-screen before you see a single tank.

  This replaces the "what you're watching" banner that used to sit above the bench: the same claim,
  reasoning and method strip, but as an opening page rather than permanent chrome, so the canvas
  gets the whole screen once you are in. The first interaction — a mouse move, a click, a key, or
  the Enter button — fades it out and the live platform is simply there underneath (the sim has been
  running the whole time; nothing is loaded on dismissal, only revealed).

  Mouse-move dismissal is ARMED after a beat: the cursor almost always moves during page load, and
  an intro that vanishes before it is read is an intro that does not exist.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import LogoMark from '../topbar/LogoMark.svelte';
	import { prefersReducedMotion, theme } from '$lib/state';
	import { THEMES } from '$lib/render';
	import { DISCLAIMER } from '../common/disclaimer';
	import { startShoal } from './shoal';

	interface Props {
		/** Called once the fade has played — the page then unmounts the intro entirely. */
		ondismiss: () => void;
	}

	let { ondismiss }: Props = $props();

	const METHOD = [
		{ term: 'policy', fact: '8→6→2 MLP · 68 evolved params · no memory' },
		{ term: 'selection', fact: 'fitness = seconds survived · elitism + tournament + crossover' },
		{ term: 'ablation', fact: 'a cut channel feeds 0, so the network shape never changes' },
		{ term: 'evidence', fact: 'each tank is ONE run; use Evaluate for n-seed means ± sd' }
	];

	let leaving = $state(false);
	let armed = false;

	function enter() {
		if (leaving) return;
		leaving = true;
	}

	function onmousemove() {
		if (armed) enter();
	}

	function onkeydown(event: KeyboardEvent) {
		// Tab keeps its job (reaching the Enter button); anything else is "let me in".
		if (event.key === 'Tab') return;
		enter();
	}

	onMount(() => {
		const arm = setTimeout(() => (armed = true), 900);
		return () => clearTimeout(arm);
	});

	// The reveal: one slow, even fade — reduced motion gets an instant cut instead.
	const duration = $derived(prefersReducedMotion() ? 0 : 700);

	// The shoal fills the right half; it keeps swimming through the fade-out and stops on unmount.
	let shoalEl = $state<HTMLCanvasElement | null>(null);
	$effect(() => {
		if (!shoalEl) return;
		return startShoal(
			shoalEl,
			() => ({ fish: THEMES[theme.name].fish, pred: THEMES[theme.name].pred }),
			prefersReducedMotion()
		);
	});
</script>

<svelte:window {onmousemove} {onkeydown} onpointerdown={enter} onwheel={enter} />

{#if !leaving}
	<section
		class="intro"
		aria-label="welcome"
		out:fade={{ duration }}
		onoutroend={ondismiss}
		data-testid="intro"
	>
		<header class="brand">
			<LogoMark size={26} />
			<span class="name">Darwin Lab</span>
			<span class="tag">agent sandbox</span>
		</header>

		<!--
			The shoal and the hunter — the product, wordless, across the intro's whole right half: a real
			flocking school of prey (separation + cohesion + alignment) and one cruising shark, the school
			flash-expanding around it and reforming behind. Decorative (aria-hidden); under reduced motion
			the flock is settled and shown parked, one still frame.
		-->
		<canvas class="chase" bind:this={shoalEl} aria-hidden="true"></canvas>

		<div class="stage">
			<h1>Behaviour that evolved,<br />not behaviour that was coded.</h1>

			<p class="argument">
				Every fish has a tiny neural network for a brain, and nothing about how it swims is written
				down. The sharks cull the ones that flee badly, generation after generation, until what is
				left is real evolved behaviour. The lab asks one question: <b>which senses actually help?</b
				>
				And a sense is worth only what the environment makes it worth. Give the fish a danger that bearing
				alone can solve and bearing pays; take it away and no sense does.
			</p>

			<button class="enter" onclick={enter}>Enter the lab</button>
			<p class="hint">move your mouse, click, or press any key</p>
		</div>

		<footer>
			<dl class="method">
				{#each METHOD as { term, fact } (term)}
					<div>
						<dt>{term}</dt>
						<dd>{fact}</dd>
					</div>
				{/each}
			</dl>
			<p class="disclaimer">{DISCLAIMER}</p>
		</footer>
	</section>
{/if}

<style>
	.intro {
		position: fixed;
		inset: 0;
		z-index: var(--z-intro);
		display: flex;
		flex-direction: column;
		padding: var(--sp-6) clamp(24px, 6vw, 96px);
		/* The same plain ground as the page beneath — the fade is a reveal, not a scene change. */
		background: var(--bgfx);
		color: var(--ink);
		cursor: pointer; /* the whole screen is the way in */
	}

	/* Pinned to the top-left, OUT of the vertical flow — so the claim below can centre against the
	   whole viewport rather than against the band left between the brand and a taller footer (which
	   pulled it up off-centre, most visibly as an empty void under the text on tall screens). */
	.brand {
		position: absolute;
		top: var(--sp-6);
		left: clamp(24px, 6vw, 96px);
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	/* The shoal owns the WHOLE right half — edge to edge vertically, behind the text's stacking
	   context, gone where there is no room for it beside the copy.

	   height: 100% is load-bearing, not a tidy-up. A <canvas> is a REPLACED element, so top:0 + bottom:0
	   with an auto height does NOT stretch it the way it would a <div> — it keeps its intrinsic ratio
	   (the default 300×150), so the box came out ~half the viewport tall, pinned to the top, and the
	   shoal filled only the top half with dead black below. An explicit height fills the column, and
	   the fit() measurement then spawns the school across the whole height. */
	.chase {
		position: absolute;
		top: 0;
		right: 0;
		width: 52%;
		height: 100%;
		pointer-events: none;
	}

	@media (max-width: 1100px) {
		.chase {
			display: none;
		}
	}

	.name {
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-bold);
		letter-spacing: -0.01em;
	}

	.tag {
		padding: 3px 9px;
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink3);
	}

	/* The claim owns the screen: display type at poster size, the reasoning at a readable measure.
	   Positioned so it stacks ABOVE the shoal canvas where the two overlap on mid-width screens —
	   a fish may pass behind the headline, never over it. */
	.stage {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--sp-5);
		max-width: 880px;
		/* EQUAL top and bottom reserve (sized to clear the taller of the two out-of-flow bands, the
		   footer) so the claim centres on the true viewport middle — asymmetric reserve would just tip
		   it off-centre again — while never riding under the logo or over the method strip when the
		   viewport is short. */
		padding-block: calc(90px + var(--sp-6));
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(34px, 5.4vw, 74px);
		font-weight: var(--fw-bold);
		letter-spacing: -0.025em;
		line-height: 1.04;
		text-wrap: balance;
	}

	.argument {
		margin: 0;
		max-width: 66ch;
		font-size: clamp(13.5px, 1.15vw, 16px);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	.enter {
		align-self: flex-start;
		margin-top: var(--sp-3);
		padding: 10px 22px;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--accentink);
		font: inherit;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.enter:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.hint {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	/* Pinned to the bottom, OUT of the vertical flow — the counterpart to the absolute brand, so the
	   stage between them centres on the whole viewport. */
	footer {
		position: absolute;
		bottom: var(--sp-6);
		left: clamp(24px, 6vw, 96px);
		right: clamp(24px, 6vw, 96px);
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	/* The method as a spec strip, ruled off from the argument — how the numbers are got. */
	.method {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: var(--sp-4) var(--sp-6);
		margin: 0;
		padding-top: var(--sp-5);
		border-top: 1px solid var(--line);
	}

	.method dt {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink3);
	}

	.method dd {
		margin: 3px 0 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	.disclaimer {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ink3);
	}
</style>
