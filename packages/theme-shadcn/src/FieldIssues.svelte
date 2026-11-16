<!--
	The issues of one Field of a form, under its input. The `id` lets the input point at them with
	`aria-describedby`. Nothing renders while there are none.

	A Theme part, exported for a replaced create or edit View that renders an input itself: give
	it the input's issues, e.g. `view.form.fields.title.issues()`.
-->
<script module lang="ts">
	import type { RemoteFormIssue } from '@svelte-admin/core';

	export type FieldIssuesProps = {
		/** The list's id, for the input's `aria-describedby`. */
		id: string;
		/** The issues to show, e.g. a remote form field's `issues()`. */
		issues: RemoteFormIssue[] | undefined;
	};
</script>

<script lang="ts">
	let { id, issues }: FieldIssuesProps = $props();
</script>

{#if issues?.length}
	<ul {id} class="flex flex-col gap-0.5 text-sm text-destructive">
		{#each issues as issue, index (index)}
			<li>{issue.message}</li>
		{/each}
	</ul>
{/if}
