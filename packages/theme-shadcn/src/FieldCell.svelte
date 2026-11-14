<!--
	A Field's value in a list View cell, shown by the Field's Kind. It is a Theme part: a
	replaced list View will render it to match the rest of the admin (exported in M1.10).
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

	/** How many items of a list the cell shows before "+N". */
	const LIST_ITEMS_SHOWN = 3;

	let { field, value }: { field: Field; value: unknown } = $props();

	const date = $derived(field.kind === 'date' ? formatDate(value) : undefined);
</script>

{#if value === null || value === undefined}
	<!-- An empty value shows as an empty cell. -->
{:else if field.kind === 'text' && typeof value === 'string'}
	{value}
{:else if field.kind === 'number' && typeof value === 'number'}
	<span class="tabular-nums">{formatNumber(value)}</span>
{:else if field.kind === 'boolean' && typeof value === 'boolean'}
	{formatBoolean(value)}
{:else if date !== undefined}
	<time datetime={value instanceof Date ? value.toISOString() : String(value)}>{date}</time>
{:else if field.kind === 'enum'}
	<Badge>{formatScalar(value)}</Badge>
{:else if field.kind === 'list' && Array.isArray(value)}
	{@const items = value.map(formatScalar)}
	<span title={items.join(', ')}>
		{items.slice(0, LIST_ITEMS_SHOWN).join(', ')}
		{#if items.length > LIST_ITEMS_SHOWN}
			<span class="text-muted-foreground">+{items.length - LIST_ITEMS_SHOWN}</span>
		{/if}
	</span>
{:else}
	<!-- Unknown, an object, or a value that doesn't fit its Kind: shown as is, muted. -->
	<span class="text-muted-foreground">{formatUnknown(value)}</span>
{/if}
