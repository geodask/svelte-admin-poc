<!--
	A Field's value on the detail View, shown by the Field's Kind. Scalars look as they do in a
	list View cell (FieldCell), but a list shows every item and an object shows as nested
	label-value pairs, one group per object for an array of objects. It is a Theme part: a
	replaced detail View will render it to match the rest of the admin (exported in M1.10).
-->
<script lang="ts">
	import type { Field } from '@svelte-admin/core';
	import FieldValue from './FieldValue.svelte';
	import { Badge } from './components/ui/badge/index.ts';
	import {
		formatBoolean,
		formatDate,
		formatNumber,
		formatScalar,
		formatUnknown
	} from './format.ts';

	let { field, value }: { field: Field; value: unknown } = $props();

	const date = $derived(field.kind === 'date' ? formatDate(value) : undefined);
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
{:else if field.kind === 'text' && typeof value === 'string'}
	<span class="whitespace-pre-line">{value}</span>
{:else if field.kind === 'number' && typeof value === 'number'}
	<span class="tabular-nums">{formatNumber(value)}</span>
{:else if field.kind === 'boolean' && typeof value === 'boolean'}
	{formatBoolean(value)}
{:else if date !== undefined}
	<time datetime={value instanceof Date ? value.toISOString() : String(value)}>{date}</time>
{:else if field.kind === 'enum'}
	<Badge>{formatScalar(value)}</Badge>
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
	<!-- Unknown, or a value that doesn't fit its Kind: shown as is, muted. -->
	<span class="text-muted-foreground">{formatUnknown(value)}</span>
{/if}
