<!--
	The Theme's `image` Kind on the create and edit Views: the Theme's URL input, with the Field's
	label, help text and issues. Whatever it holds is saved as typed; the Views only load it as an
	image when the core's `imageSrc` rule allows it. FieldInput renders it for a text Field only.
-->
<script lang="ts">
	import type { FormInputSpec, KindInputProps } from '@svelte-admin/core';
	import FieldInput from '../FieldInput.svelte';

	let { spec, field }: KindInputProps = $props();

	// Without its named Kind, so FieldInput renders its own input, not this Kind again.
	const urlSpec = $derived<FormInputSpec>({
		...spec,
		namedKind: undefined,
		kind: 'text',
		format: 'url'
	});
</script>

<FieldInput spec={urlSpec} {field} />
