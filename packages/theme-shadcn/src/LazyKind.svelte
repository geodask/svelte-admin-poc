<!--
	One Kind's component, loaded from its lazy import and rendered with its slot's props. It awaits
	the import in place, so the server renders the component too, with no pending state. FieldCell,
	FieldValue and FieldInput render it for a Field whose Kind gives a component for their slot.
-->
<script lang="ts" generics="P extends Record<string, unknown>">
	import type { KindComponent } from '@svelte-admin/core';

	let { component, props }: { component: KindComponent<P>; props: P } = $props();

	const Kind = $derived((await component()).default);
</script>

<Kind {...props} />
