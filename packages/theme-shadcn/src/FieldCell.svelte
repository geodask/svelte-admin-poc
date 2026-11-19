<!--
	A Field's value in a list View cell, shown by the Field's Kind, as a link when given an href.
	A Kind's `cell` renders it when one is found, slot by slot: the app's Kind of the Field's named
	Kind (given the admin), the Theme's, then the app's Kind of its built-in Kind (see the core's
	`kindComponent`). A Theme Kind's cell renders only a value that fits it (badges a list), and
	any other renders as its built-in Kind. Otherwise the Theme renders the built-in Kind itself.
	Given the admin, a
	Reference shows the Record title of the record it points to, linked to that record's detail
	View (see ReferenceValue); without it, the raw id. An empty value is an empty cell, whatever
	the Kind. A Theme part, exported so a replaced list View shows values as the stock one does.
-->
<script module lang="ts">
	import type { Admin, Field } from '@svelte-admin/core';

	export type FieldCellProps = {
		/** The Field, e.g. one of `view.fields` from the core's `createListView`. */
		field: Field;
		/** The record's value for the Field. */
		value: unknown;
		/**
		 * The whole record the value belongs to, which a Kind's cell gets beside the value. Without
		 * it, the Kind gets a record that holds only this value.
		 */
		record?: Record<string, unknown>;
		/**
		 * The admin from admin.ts (`view.admin`), so the app's Kinds render the cell and a Reference
		 * shows its record's title.
		 */
		admin?: Admin;
		/** Where the cell links to, e.g. the record's detail View (`view.recordHref(record)`). */
		href?: string;
	};
</script>

<script lang="ts">
	import LazyKind from './LazyKind.svelte';
	import ReferenceValue from './ReferenceValue.svelte';
	import ScalarValue from './ScalarValue.svelte';
	import { CELL_ITEMS_SHOWN, formatScalar } from './format.ts';
	import { themeKindComponent } from './kinds.ts';

	let { field, value, record, admin, href }: FieldCellProps = $props();

	const kind = $derived(themeKindComponent('cell', field, value, admin?.kinds));
</script>

{#snippet content()}
	{#if value === null || value === undefined}
		<!-- An empty value shows as an empty cell. -->
	{:else if kind}
		<LazyKind component={kind} props={{ field, value, record: record ?? { [field.key]: value } }} />
	{:else if field.kind === 'reference' && admin && (typeof value === 'string' || typeof value === 'number')}
		<!-- Inside the cell's own link, the title is plain text: a link can't hold another. -->
		<ReferenceValue {admin} {field} {value} linked={href === undefined} />
	{:else if field.kind === 'list' && Array.isArray(value)}
		{@const items = value.map(formatScalar)}
		<span title={items.join(', ')}>
			{items.slice(0, CELL_ITEMS_SHOWN).join(', ')}
			{#if items.length > CELL_ITEMS_SHOWN}
				<span class="text-muted-foreground">+{items.length - CELL_ITEMS_SHOWN}</span>
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
