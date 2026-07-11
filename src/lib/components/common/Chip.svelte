<!--
  A small static label. Two shapes, both from the design reference:

    pill  fully rounded — "Gen 12", "20 prey · 2 sharks · 640×400"
    tag   a squarer micro-label in tracked-out caps — "live evolution"

  `tone="accent"` tints it with the accent. A world tile passes its OWN accent in — the tile's
  index badge is tinted per world — by setting `--chip-accent` on the element:

      <Chip tone="accent" style="--chip-accent: {world.cfg.accent}">01</Chip>

  Not interactive by design. A chip you can click is a Button or (Phase 4) a sense toggle pill.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		children: Snippet;
		variant?: 'pill' | 'tag';
		tone?: 'neutral' | 'accent';
		/** Stat chips whose digits change in place ("Gen 12") must not jitter. */
		tabular?: boolean;
	}

	let { children, variant = 'pill', tone = 'neutral', tabular = false, ...rest }: Props = $props();
</script>

<span class={['chip', variant, tone, tabular && 'tabular']} {...rest}>
	{@render children()}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		white-space: nowrap;
	}

	.pill {
		padding: 3px var(--sp-3);
		border-radius: var(--radius-pill);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
	}

	.tag {
		padding: 3px 7px;
		border-radius: var(--radius-chip);
		font-size: var(--fs-label);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
	}

	.neutral {
		background: var(--chip);
		color: var(--ink2);
	}

	/* Falls back to the theme accent, so a plain `tone="accent"` needs no wiring. */
	.accent {
		--chip-accent: var(--accent);
		background: color-mix(in srgb, var(--chip-accent) 14%, transparent);
		color: var(--chip-accent);
	}
</style>
