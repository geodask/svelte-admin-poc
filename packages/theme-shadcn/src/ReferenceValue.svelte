<!--
	A Reference's value: the Record title of the record it points to, linked to that record's
	detail View (or as plain text with `linked` false, e.g. inside a cell that is a link already).
	A record that doesn't exist, or a lookup that failed, shows the raw id, muted, with text for
	screen readers saying it wasn't found; the View around it still renders. It awaits the lookup,
	so the server renders the title too. FieldCell and FieldValue render it when given the admin.
-->
<script lang="ts">
	import { resolveReference, type Admin, type Field } from '@svelte-admin/core';

	let {
		admin,
		field,
		value,
		linked = true
	}: {
		/** The admin from admin.ts, through which the target's `lookup` is reached. */
		admin: Admin;
		/** A Reference Field. */
		field: Field;
		/** The id the Reference holds. */
		value: string | number;
		/** Whether to link the title to the record's detail View. */
		linked?: boolean;
	} = $props();

	const link = $derived(await resolveReference(admin, field, value));
</script>

{#if link === undefined}
	<span class="text-muted-foreground">
		{value} <span class="sr-only">(not found)</span>
	</span>
{:else if linked && link.href !== undefined}
	<a href={link.href} class="underline-offset-4 hover:underline">{link.title}</a>
{:else}
	{link.title}
{/if}
