<!--
	A Field's value in a list View cell, shown by the Field's Kind. It is a Theme part: a
	replaced list View can render it to match the rest of the admin.
-->
<script lang="ts" module>
	/** How many items of a list the cell shows before "+N". */
	export const LIST_ITEMS_SHOWN = 3;
</script>

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
</script>

{#if value === null || value === undefined}
	<!-- An empty value shows as an empty cell. -->
{:else if field.kind === 'text' && typeof value === 'string'}
	{value}
{:else if field.kind === 'number' && (typeof value === 'number' || typeof value === 'bigint')}
	<span class="tabular-nums">{formatNumber(value)}</span>
{:else if field.kind === 'boolean' && typeof value === 'boolean'}
	{formatBoolean(value)}
{:else if field.kind === 'date' && formatDate(value) !== undefined}
	<time datetime={value instanceof Date ? value.toISOString() : String(value)}>
		{formatDate(value)}
	</time>
{:else if field.kind === 'enum'}
	<Badge variant="secondary">{formatScalar(value)}</Badge>
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
