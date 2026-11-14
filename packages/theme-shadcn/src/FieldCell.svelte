<!--
	A Field's value in a list View cell, shown by the Field's Kind, as a link when given an href.
	It is a Theme part: a replaced list View will render it to match the rest of the admin
	(exported in M1.10).
-->
<script lang="ts">
	import type { Field } from '@svelte-admin/core';
	import ScalarValue from './ScalarValue.svelte';
	import { formatScalar } from './format.ts';

	/** How many items of a list the cell shows before "+N". */
	const LIST_ITEMS_SHOWN = 3;

	let {
		field,
		value,
		href
	}: {
		field: Field;
		value: unknown;
		/** Where the cell links to, e.g. the record's detail View. */
		href?: string;
	} = $props();
</script>

{#snippet content()}
	{#if value === null || value === undefined}
		<!-- An empty value shows as an empty cell. -->
	{:else if field.kind === 'list' && Array.isArray(value)}
		{@const items = value.map(formatScalar)}
		<span title={items.join(', ')}>
			{items.slice(0, LIST_ITEMS_SHOWN).join(', ')}
			{#if items.length > LIST_ITEMS_SHOWN}
				<span class="text-muted-foreground">+{items.length - LIST_ITEMS_SHOWN}</span>
			{/if}
		</span>
	{:else}
		<ScalarValue {field} {value} />
	{/if}
{/snippet}

{#if href === undefined}
	{@render content()}
{:else}
	<a {href} class="font-medium underline-offset-4 hover:underline">
		{#if value === null || value === undefined || value === ''}
			<span class="text-muted-foreground">Open</span>
		{:else}
			{@render content()}
		{/if}
	</a>
{/if}
