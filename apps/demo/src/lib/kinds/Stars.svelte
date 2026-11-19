<!--
	A rating from 1 to 5 as stars, with the rating as text for screen readers: the `stars` Kind's
	cell in the list View and its display on the detail View. A value that is no rating shows as it
	is, muted.
-->
<script lang="ts">
	import type { KindCellProps } from '@svelte-admin/core';

	// The rating alone: a Kind's component may take fewer props than its slot gives.
	let { value }: Pick<KindCellProps, 'value'> = $props();

	const MAX = 5;
	const rating = $derived(
		typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX
			? value
			: undefined
	);
</script>

{#if rating === undefined}
	<span class="text-muted-foreground">{String(value)}</span>
{:else}
	<span aria-hidden="true" class="tracking-wide whitespace-nowrap text-amber-500"
		>{'★'.repeat(rating)}{'☆'.repeat(MAX - rating)}</span
	>
	<span class="sr-only">{rating} out of {MAX} stars</span>
{/if}
