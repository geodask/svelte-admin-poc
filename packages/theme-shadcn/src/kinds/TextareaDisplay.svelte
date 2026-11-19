<!--
	The Theme's `textarea` Kind on the detail View: the text with its line breaks. A value that
	isn't text shows as the built-in value.
-->
<script lang="ts">
	import type { KindDisplayProps } from '@svelte-admin/core';
	import FieldValue from '../FieldValue.svelte';
	import { withoutNamedKind } from '../kinds.ts';

	let { field, value, record }: KindDisplayProps = $props();
</script>

{#if typeof value === 'string'}
	<span class="break-words whitespace-pre-wrap">{value}</span>
{:else}
	<FieldValue field={withoutNamedKind(field)} {value} {record} />
{/if}
