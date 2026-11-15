<!--
	The issues of one Field of a form, under its input. The `id` lets the input point at them with
	`aria-describedby`. Nothing renders while there are none.
-->
<script lang="ts">
	import type { RemoteFormIssue } from '@svelte-admin/core';

	let { id, issues }: { id: string; issues: RemoteFormIssue[] | undefined } = $props();
</script>

{#if issues?.length}
	<ul {id} class="flex flex-col gap-0.5 text-sm text-destructive">
		{#each issues as issue, index (index)}
			<li>{issue.message}</li>
		{/each}
	</ul>
{/if}
