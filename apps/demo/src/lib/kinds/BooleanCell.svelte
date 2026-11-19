<!--
	A boolean in a list View cell as ✓ or ✗, with "Yes" or "No" for screen readers. admin.ts
	registers it as the built-in `boolean` Kind's cell only, so the detail View and the forms keep
	the Theme's "Yes", "No" and checkbox: a Kind replaces a Theme's rendering slot by slot.
-->
<script lang="ts">
	import type { KindCellProps } from '@svelte-admin/core';

	let { value }: Pick<KindCellProps, 'value'> = $props();
</script>

{#if typeof value === 'boolean'}
	<span aria-hidden="true">{value ? '✓' : '✗'}</span>
	<span class="sr-only">{value ? 'Yes' : 'No'}</span>
{:else}
	<span class="text-muted-foreground">{String(value)}</span>
{/if}
