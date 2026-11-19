<!--
	The `numberOrSlug` Kind's input on the create and edit Views: the Theme's text input, with the
	Field's label, help text and issues. It sends what was typed, which the Kind's `fromInput` (in
	admin.ts) reads as a number or a slug, and the edit form shows the value as text (`toInput`).
-->
<script lang="ts">
	import type { FormInputSpec, KindInputProps } from '@svelte-admin/core';
	import { FieldInput } from '@svelte-admin/theme-shadcn';

	let { spec, field }: KindInputProps = $props();

	// Without its named Kind, so FieldInput renders its own text input, not this Kind again.
	const textSpec = $derived<FormInputSpec>({
		...spec,
		namedKind: undefined,
		kind: 'text',
		format: 'text'
	});
</script>

<FieldInput spec={textSpec} {field} />
