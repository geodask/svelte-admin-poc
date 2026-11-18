<!--
	A Field's value shown by its Kind, for every Kind that looks the same in a list View cell and
	on the detail View: text, a number, a boolean, a date, an enum, and a Reference shown by its raw
	id (where no admin is given to show its record's title). Anything else (unknown, or a value
	that doesn't fit its Kind) shows as is, muted. FieldCell and FieldValue render it and
	handle what differs between them: empty values, lists and objects.
-->
<script lang="ts">
	import type { Field } from '@svelte-admin/core';
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
</script>

{#if field.kind === 'text' && typeof value === 'string'}
	{value}
{:else if field.kind === 'reference' && (typeof value === 'string' || typeof value === 'number')}
	{value}
{:else if field.kind === 'number' && typeof value === 'number'}
	<span class="tabular-nums">{formatNumber(value)}</span>
{:else if field.kind === 'boolean' && typeof value === 'boolean'}
	{formatBoolean(value)}
{:else if date !== undefined}
	<time datetime={value instanceof Date ? value.toISOString() : String(value)}>{date}</time>
{:else if field.kind === 'enum'}
	<Badge>{formatScalar(value)}</Badge>
{:else}
	<span class="text-muted-foreground">{formatUnknown(value)}</span>
{/if}
