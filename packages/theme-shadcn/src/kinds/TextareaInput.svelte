<!--
	The Theme's `textarea` Kind on the create and edit Views: the Theme's textarea, with the
	Field's label, help text and issues. The core reads its line breaks as LF, as for
	`input: 'textarea'`. FieldInput renders it for a text Field only.
-->
<script lang="ts">
	import type { FormInputSpec, KindInputProps } from '@svelte-admin/core';
	import FieldInput from '../FieldInput.svelte';

	let { spec, field }: KindInputProps = $props();

	// Without its named Kind, so FieldInput renders its own textarea, not this Kind again.
	const textareaSpec = $derived<FormInputSpec>({ ...spec, namedKind: undefined, kind: 'textarea' });
</script>

<FieldInput spec={textareaSpec} {field} />
