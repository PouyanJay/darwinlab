<!--
  The lab's mark: an accent disc with a danger-coloured notch biting into its corner — prey and
  predator in one 24px circle. Purely decorative; the wordmark next to it carries the name.
-->
<div class="mark" aria-hidden="true">
	<span class="notch"></span>
</div>

<style>
	.mark {
		position: relative;
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--accent);
		box-shadow: inset 0 -6px 10px rgba(0, 0, 0, 0.14);
	}

	.notch {
		position: absolute;
		right: -5px;
		bottom: -5px;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--danger);
	}
</style>
