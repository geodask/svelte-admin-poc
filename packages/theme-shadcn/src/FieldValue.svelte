<!--
	A Field's value on the detail View, shown by the Field's Kind. Scalars look as they do in a
	list View cell, but a list shows every item, an object shows as nested label-value pairs (one
	group per object for an array of objects), and an empty value shows as a dash. A Theme part,
	exported so a replaced detail View shows values as the stock one does.
-->
<script module lang="ts">
	import type { Field } from '@svelte-admin/core';

	export type FieldValueProps = {
		/** The Field, e.g. one of `view.fields` from the core's `createDetailView`. */
		field: Field;
		/** The record's value for the Field. */
		value: unknown;
	};
</script>

<script lang="ts">
	import FieldValue from './FieldValue.svelte';
	import ScalarValue from './ScalarValue.svelte';
	import { formatScalar } from './format.ts';

	let { field, value }: FieldValueProps = $props();

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
