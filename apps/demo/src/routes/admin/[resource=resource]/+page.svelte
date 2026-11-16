<script lang="ts">
	import { ListView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const entry = $derived(admin.resources[params.resource]);
	// The Resource and its remote functions change together, once the new remote module has
	// loaded. Read apart, a switch to another Resource would briefly pair the new Resource with the
	// old Resource's remote functions, and ask them for a list they don't take (another sort).
	const { resource, remote } = $derived(
		await entry.remote().then((remote) => ({ resource: entry.resource, remote }))
	);
</script>

<ListView {resource} {remote} />
