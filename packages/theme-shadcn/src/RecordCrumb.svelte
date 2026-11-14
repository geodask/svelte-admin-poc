<!--
	The breadcrumb's last crumb on a detail View: the record's Record title. It reads the record
	through the core's headless detail View, the same query the detail View awaits, so both share
	one request. A failed read is the detail View's to report; the crumb only says "Not found" or
	"Error", and shows the title once a Retry loads the record.
-->
<script lang="ts">
	import type { ResourceRemote } from '@svelte-admin/core';
	import { createDetailView, type ShellLocation } from '@svelte-admin/core/views';
	import * as Breadcrumb from './components/ui/breadcrumb/index.ts';

	let { here, id }: { here: ShellLocation; id: string | number } = $props();

	const remote: ResourceRemote = $derived(await here.remote());
	const view = $derived(createDetailView(here.resource, remote, id));
	const title = $derived(
		await view.query.then(
			(record) => view.title(record),
			(error: { status?: number } | undefined) => (error?.status === 404 ? 'Not found' : 'Error')
		)
	);
</script>

<Breadcrumb.Page>{title}</Breadcrumb.Page>
