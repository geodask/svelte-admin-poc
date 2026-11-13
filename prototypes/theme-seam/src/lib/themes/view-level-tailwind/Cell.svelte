<!-- Theme A1 decides how each Field kind looks in a list. -->
<script lang="ts">
	import type { Column } from '#lib/core/columns.ts';
	import type { ListView } from '#lib/core/list-view.svelte.ts';
	let { col, value, list }: { col: Column; value: unknown; list: ListView } = $props();
	const badge = 'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium';
</script>

{#if value === undefined || value === null}<span class="text-muted-foreground">—</span>
{:else if col.kind === 'enum'}<span class={badge}>{value}</span>
{:else if col.kind === 'boolean'}<span class={value ? 'text-emerald-600' : 'text-muted-foreground'}>{value ? '✓' : '—'}</span>
{:else if col.kind === 'list'}
	<span class="flex flex-wrap gap-1">{#each value as string[] as t}<span class="{badge} bg-muted border-transparent">{t}</span>{/each}</span>
{:else}{list.format(col, value)}{/if}
