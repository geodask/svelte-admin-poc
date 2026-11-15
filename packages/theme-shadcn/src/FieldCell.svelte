<!--
	A Field's value in a list View cell, shown by the Field's Kind, as a link when given an href.
	A Theme part, exported so a replaced list View shows values as the stock one does.
-->
<script module lang="ts">
	import type { Field } from '@svelte-admin/core';

	export type FieldCellProps = {
		/** The Field, e.g. one of `view.fields` from the core's `createListView`. */
		field: Field;
		/** The record's value for the Field. */
		value: unknown;
		/** Where the cell links to, e.g. the record's detail View (`view.recordHref(record)`). */
		href?: string;
	};
</script>

<script lang="ts">
	import ScalarValue from './ScalarValue.svelte';
	import { formatScalar } from './format.ts';

	/** How many items of a list the cell shows before "+N". */
	const LIST_ITEMS_SHOWN = 3;

	let { field, value, href }: FieldCellProps = $props();
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
