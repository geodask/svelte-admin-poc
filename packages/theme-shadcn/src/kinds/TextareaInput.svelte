<!--
	The Theme's `textarea` Kind on the create and edit Views: the Theme's textarea, with the
	Field's label, help text and issues. The core reads its line breaks as LF, as for
	`input: 'textarea'`. A Field that isn't text gets its built-in input.
-->
<script lang="ts">
	import type { FormInputSpec, KindInputProps } from '@svelte-admin/core';
	import FieldInput from '../FieldInput.svelte';
	import { withoutNamedKind } from '../kinds.ts';

	let { spec, field }: KindInputProps = $props();

	const textarea = $derived.by((): FormInputSpec => {
		if (spec.kind !== 'text') return withoutNamedKind(spec);
		const { key, label, required, description, placeholder } = spec;
		return { key, label, required, description, placeholder, kind: 'textarea' };
	});
</script>

<FieldInput spec={textarea} {field} />
