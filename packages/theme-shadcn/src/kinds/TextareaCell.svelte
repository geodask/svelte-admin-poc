<!--
	The Theme's `textarea` Kind in a list View cell: the text on one line, cut with an ellipsis,
	with the full text in its `title`. FieldCell renders it for text only.
-->
<script lang="ts">
	import type { KindCellProps } from '@svelte-admin/core';

	let { value }: Pick<KindCellProps, 'value'> = $props();
</script>

<span class="block max-w-xs truncate" title={String(value)}>{value}</span>
