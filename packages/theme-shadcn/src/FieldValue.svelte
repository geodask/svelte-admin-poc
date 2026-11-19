<!--
	A Field's value on the detail View, shown by the Field's Kind. Scalars look as they do in a
	list View cell, but a list shows every item, an object shows as nested label-value pairs (one
	group per object for an array of objects), and an empty value shows as a dash. A Kind's `display`
	renders a value when one is found, slot by slot: the app's Kind of the Field's named Kind (given
	the admin), the Theme's, then the app's Kind of its built-in Kind (see the core's
	`kindComponent`). A Theme Kind's display renders only a value that fits it (badges a list),
	and any other renders as its built-in Kind. Otherwise the Theme renders the built-in Kind
	itself. Given the admin,
	a Reference shows the Record title of the record it points to, linked to that record's detail
	View (see ReferenceValue); without it, the raw id. A Theme part, exported so a replaced detail
	View shows values as the stock one does.
-->
<script module lang="ts">
	import type { Admin, Field } from '@svelte-admin/core';

	export type FieldValueProps = {
		/** The Field, e.g. one of `view.fields` from the core's `createDetailView`. */
		field: Field;
		/** The record's value for the Field. */
		value: unknown;
		/**
		 * The whole record the value belongs to, which a Kind's display gets beside the value.
		 * Without it, the Kind gets a record that holds only this value.
		 */
		record?: Record<string, unknown>;
		/**
		 * The admin from admin.ts (`view.admin`), so the app's Kinds render the value and a
		 * Reference shows its record's title.
		 */
		admin?: Admin;
	};
</script>

<script lang="ts">
	import FieldValue from './FieldValue.svelte';
	import LazyKind from './LazyKind.svelte';
	import ReferenceValue from './ReferenceValue.svelte';
	import ScalarValue from './ScalarValue.svelte';
	import { formatScalar } from './format.ts';
	import { themeKindComponent } from './kinds.ts';

	let { field, value, record, admin }: FieldValueProps = $props();

	const kind = $derived(themeKindComponent('display', field, value, admin?.kinds));

	const nested = $derived(field.fields?.filter((f) => f.detail));
	const isObject = (v: unknown): v is Record<string, unknown> =>
		typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
</script>

{#snippet pairs(fields: readonly Field[], object: Record<string, unknown>)}
	<dl class="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
		{#each fields as inner (inner.key)}
			<dt class="text-muted-foreground">{inner.label}</dt>
			<dd><FieldValue field={inner} value={object[inner.key]} /></dd>
		{/each}
	</dl>
{/snippet}

{#if value === null || value === undefined || (Array.isArray(value) && value.length === 0)}
	<span class="text-muted-foreground">—</span>
{:else if kind}
	<LazyKind component={kind} props={{ field, value, record: record ?? { [field.key]: value } }} />
{:else if field.kind === 'reference' && admin && (typeof value === 'string' || typeof value === 'number')}
	<ReferenceValue {admin} {field} {value} />
{:else if field.kind === 'list' && Array.isArray(value)}
	{value.map(formatScalar).join(', ')}
{:else if nested && isObject(value)}
	{@render pairs(nested, value)}
{:else if nested && Array.isArray(value) && value.every(isObject)}
	<ol class="flex flex-col gap-3">
		{#each value as item, index (index)}
			<li>{@render pairs(nested, item)}</li>
		{/each}
	</ol>
{:else}
	<ScalarValue {field} {value} />
{/if}
