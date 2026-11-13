<script lang="ts">
	import { AdminShell } from '@svelte-admin/theme-shadcn';

	let { children } = $props();
</script>

<AdminShell>
	{@render children()}
</AdminShell>
