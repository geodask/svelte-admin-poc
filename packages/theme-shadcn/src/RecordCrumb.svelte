<!--
	The breadcrumb's crumb for a record: its Record title, the last crumb on a detail View, or a
	link to the detail View (`href`) on the edit View. It reads the record
	through the core's headless detail View, the same query the detail View awaits, so both share
	one request. A failed read is the detail View's to report; the crumb only says "Not found" or
	"Error", and shows the title once a Retry loads the record.
-->
<script lang="ts">
	import type { Admin, ResourceRemote } from '@svelte-admin/core';
	import { createDetailView, type ShellLocation } from '@svelte-admin/core/views';
	import * as Breadcrumb from './components/ui/breadcrumb/index.ts';

	let {
		admin,
		here,
		id,
		href
	}: { admin: Admin; here: ShellLocation; id: string | number; href?: string | undefined } =
		$props();

	const remote: ResourceRemote = $derived(await here.remote());
	const view = $derived(createDetailView(admin, here.resource, remote, id));
	const title = $derived(
		await view.query.then(
			(record) => view.title(record),
			(error: { status?: number } | undefined) => (error?.status === 404 ? 'Not found' : 'Error')
		)
	);
</script>

{#if href === undefined}
	<Breadcrumb.Page>{title}</Breadcrumb.Page>
{:else}
	<Breadcrumb.Link {href}>{title}</Breadcrumb.Link>
{/if}
