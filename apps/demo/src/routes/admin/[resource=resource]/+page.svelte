<script lang="ts">
	import { ListView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const { resource, remote } = $derived(await admin.entry(params.resource));
</script>

<ListView {admin} {resource} {remote} />
