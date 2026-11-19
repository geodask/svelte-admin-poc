<!--
	The Theme's `badges` Kind on the detail View: every item as a badge. A value that isn't a list
	of text or enum values shows as the built-in value.
-->
<script lang="ts">
	import type { KindDisplayProps } from '@svelte-admin/core';
	import FieldValue from '../FieldValue.svelte';
	import { isBadgeList, withoutNamedKind } from '../kinds.ts';
	import Badges from './Badges.svelte';

	let { field, value, record }: KindDisplayProps = $props();
</script>

{#if isBadgeList(value)}
	<Badges items={value} class="flex-wrap" />
{:else}
	<FieldValue field={withoutNamedKind(field)} {value} {record} />
{/if}
