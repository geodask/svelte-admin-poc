<!--
	The error page, carried over from the proof of concept. The app's `+error.svelte` renders it
	with the values from `page`, so the Theme stays free of SvelteKit imports.
-->
<script lang="ts">
	let {
		status,
		message,
		path,
		homeHref
	}: {
		/** The HTTP status, e.g. 404. */
		status: number;
		/** The error's message, shown for statuses without a message of their own. */
		message?: string;
		/** The pathname that failed. */
		path: string;
		/** Where "Back to the admin" links to, e.g. the admin's base path. */
		homeHref: string;
	} = $props();

	const messages: Record<number, { title: string; description: string }> = {
		404: {
			title: 'Page not found',
			description: 'The page you are looking for does not exist or has been moved.'
		},
		500: {
			title: 'Server error',
			description: 'Something went wrong on our end. Please try again later.'
		},
		403: {
			title: 'Access denied',
			description: "You don't have permission to access this page."
		}
	};

	const info = $derived(
		messages[status] ?? {
			title: `Error ${status}`,
			description: message ?? 'An unexpected error occurred.'
		}
	);
</script>

<svelte:head>
	<title>{info.title}</title>
</svelte:head>

<div class="flex min-h-[80vh] flex-col items-center justify-center px-4">
	<div class="relative mb-8 select-none" aria-hidden="true">
		<span
			class="text-[10rem] leading-none font-black tracking-tighter text-foreground/5 sm:text-[14rem]"
		>
			{status}
		</span>
	</div>

	<div class="flex max-w-md flex-col items-center text-center">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">{info.title}</h1>
		{#if status === 404}
			<p class="mt-2 text-sm text-muted-foreground">
				Nothing found at
				<code
					class="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
				>
					{path}
				</code>
			</p>
		{:else}
			<p class="mt-2 text-sm text-muted-foreground">{info.description}</p>
		{/if}

		<div class="my-6 h-px w-16 bg-border"></div>

		<div class="flex items-center gap-3">
			<a
				href={homeHref}
				class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			>
				Back to the admin
			</a>
			<button
				type="button"
				class="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
				onclick={() => history.back()}
			>
				Go back
			</button>
		</div>

		<p class="mt-8 font-mono text-xs text-muted-foreground/60">{path}</p>
	</div>
</div>
