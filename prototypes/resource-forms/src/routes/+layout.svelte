<script lang="ts">
	import PrototypeSwitcher from '#lib/PrototypeSwitcher.svelte';
	let { children } = $props();
</script>

<svelte:head><title>PROTOTYPE: schema-driven forms</title></svelte:head>

<header>
	<strong>Svelte Admin</strong> <span class="badge">PROTOTYPE (PER-17), throwaway</span>
	<nav><a href="/recipes">Recipes</a> · <a href="/recipes/new">New recipe</a> · <a href="/recipes/1/edit">Edit recipe 1</a></nav>
</header>

<main>
	<svelte:boundary>
		{@render children()}
		{#snippet failed(error, reset)}<p>Error: {(error as Error).message}</p><button onclick={reset}>Retry</button>{/snippet}
	</svelte:boundary>
</main>

<PrototypeSwitcher />

<style>
	:global(body) { font: 15px/1.45 system-ui, sans-serif; margin: 0; color: #1d1d1f; background: #fafafa; }
	header { display: flex; gap: 1rem; align-items: center; padding: 0.75rem 1.25rem; background: #fff; border-bottom: 1px solid #ddd; }
	header nav { margin-left: auto; }
	.badge { font-size: 12px; background: #fde68a; padding: 2px 6px; border-radius: 4px; }
	main { padding: 1.25rem; max-width: 1200px; margin: 0 auto; }
	:global(.layout) { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 1.5rem; align-items: start; }
	:global(form) { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 1.25rem; display: grid; gap: 0.9rem; }
	:global(.field) { display: grid; gap: 0.25rem; }
	:global(.field.inline) { grid-template-columns: auto 1fr; align-items: center; column-gap: 0.5rem; }
	:global(.field.inline .issue) { grid-column: 1 / -1; }
	:global(.label), :global(legend) { font-weight: 600; font-size: 14px; }
	:global(.req) { color: #b91c1c; }
	:global(.opt) { font-weight: 400; color: #666; }
	:global(input:not([type=checkbox])), :global(select), :global(textarea) { font: inherit; padding: 0.4rem 0.55rem; border: 1px solid #bbb; border-radius: 6px; }
	:global([aria-invalid='true']) { border-color: #b91c1c !important; background: #fef2f2; }
	:global(.issue) { color: #b91c1c; margin: 0; font-size: 13px; }
	:global(small) { color: #666; }
	:global(fieldset) { border: 1px solid #ddd; border-radius: 6px; padding: 0.6rem 0.8rem; display: grid; gap: 0.5rem; }
	:global(.row) { display: flex; gap: 0.5rem; align-items: end; }
	:global(.row > .field) { flex: 1; }
	:global(.row.blank) { opacity: 0.65; }
	:global(.remove) { border: none; background: none; font-size: 20px; cursor: pointer; color: #888; }
	:global(.readonly output) { color: #444; }
	:global(.tag) { font-weight: 400; font-size: 11px; background: #eee; padding: 1px 5px; border-radius: 4px; }
	:global(.actions) { display: flex; gap: 0.75rem; align-items: center; }
	:global(button[type=submit]) { font: inherit; padding: 0.5rem 1rem; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
	:global(.state) { font-size: 12px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 0.75rem; }
	:global(.state h3) { margin: 0 0 0.5rem; font-size: 14px; }
	:global(.state pre) { white-space: pre-wrap; word-break: break-word; background: #f5f5f5; padding: 0.5rem; border-radius: 4px; margin: 0.25rem 0 0.75rem; }
	:global(.state summary) { cursor: pointer; font-weight: 600; }
	:global(.switcher) { position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.75rem; align-items: center; background: #111; color: #fff; padding: 0.4rem 0.75rem; border-radius: 999px; box-shadow: 0 4px 16px rgba(0,0,0,.25); font-size: 13px; z-index: 10; }
	:global(.switcher button) { background: #333; color: #fff; border: none; border-radius: 999px; width: 28px; height: 28px; cursor: pointer; }
	:global(table) { border-collapse: collapse; background: #fff; }
	:global(td), :global(th) { border: 1px solid #ddd; padding: 0.35rem 0.6rem; text-align: left; }
	:global(.saved) { background: #dcfce7; padding: 0.5rem 0.75rem; border-radius: 6px; }
</style>
