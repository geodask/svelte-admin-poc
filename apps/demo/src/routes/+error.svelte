<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ErrorPage } from '@svelte-admin/theme-shadcn';
</script>

<ErrorPage
	status={page.status}
	message={page.error?.message}
	path={page.url.pathname}
	homeHref={resolve('/admin')}
/>
