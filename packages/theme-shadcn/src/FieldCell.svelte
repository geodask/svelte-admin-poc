<!--
	A Field's value in a list View cell, shown by the Field's Kind, as a link when given an href.
	Given the admin, a Reference shows the Record title of the record it points to, linked to that
	record's detail View (see ReferenceValue); without it, the raw id. A Theme part, exported so a
	replaced list View shows values as the stock one does.
-->
<script module lang="ts">
	import type { Admin, Field } from '@svelte-admin/core';

	export type FieldCellProps = {
		/** The Field, e.g. one of `view.fields` from the core's `createListView`. */
		field: Field;
		/** The record's value for the Field. */
		value: unknown;
		/**
		 * The whole record the value belongs to, for the Kinds that render from more than one value.
		 * The stock Kinds read only `value` so far.
		 */
		record?: Record<string, unknown>;
		/** The admin from admin.ts (`view.admin`), so a Reference shows its record's title. */
		admin?: Admin;
		/** Where the cell links to, e.g. the record's detail View (`view.recordHref(record)`). */
		href?: string;
	};
</script>

<script lang="ts">
	import ReferenceValue from './ReferenceValue.svelte';
	import ScalarValue from './ScalarValue.svelte';
	import { formatScalar } from './format.ts';

	/** How many items of a list the cell shows before "+N". */
	const LIST_ITEMS_SHOWN = 3;

	// eslint-disable-next-line svelte/no-unused-props -- `record` is there for the Kinds that will read it
	let { field, value, admin, href }: FieldCellProps = $props();
</script>

{#snippet content()}
	{#if value === null || value === undefined}
		<!-- An empty value shows as an empty cell. -->
	{:else if field.kind === 'reference' && admin && (typeof value === 'string' || typeof value === 'number')}
		<!-- Inside the cell's own link, the title is plain text: a link can't hold another. -->
		<ReferenceValue {admin} {field} {value} linked={href === undefined} />
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
