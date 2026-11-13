<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { open, title, description, onclose, actions }: PropsOf<'Dialog'> = $props();
</script>
<!-- this Theme chose an inline confirm bar instead of a modal: allowed, the contract only fixes props -->
{#if open}
	<div class="bar" role="alertdialog" aria-label={title}>
		<strong>{title}</strong> {description} {@render actions()}
		<button class="x" onclick={onclose} aria-label="Close">×</button>
	</div>
{/if}
<style>
	.bar { position: fixed; left: 50%; top: 1rem; transform: translateX(-50%); display: flex; gap: 0.6rem; align-items: center; background: #fffaf0; border: 2px solid #8a3b12; border-radius: 999px; padding: 0.5rem 1rem; font-family: Georgia, serif; z-index: 20; }
	.x { border: none; background: none; font-size: 18px; cursor: pointer; }
</style>
