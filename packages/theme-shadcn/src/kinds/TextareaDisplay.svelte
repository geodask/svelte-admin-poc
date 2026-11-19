<!--
	The Theme's `textarea` Kind on the detail View: the text with its line breaks. FieldValue
	renders it for text only.
-->
<script lang="ts">
	import type { KindDisplayProps } from '@svelte-admin/core';

	let { value }: Pick<KindDisplayProps, 'value'> = $props();
</script>

<span class="break-words whitespace-pre-wrap">{value}</span>
