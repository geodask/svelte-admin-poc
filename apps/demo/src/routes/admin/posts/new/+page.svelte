<!--
	A replaced View: the posts create View, written by hand instead of the stock one. A route at a
	Resource's create path (`{list}/new`) wins over the admin's `[resource]` route. It keeps the
	stock View's behaviour through the core's `createFormView` (the check before sending, issues
	after the first submit, plain form posts without JavaScript, and the landing on the new post's
	detail View), and matches the admin through the Theme's exported form parts. It lays the Fields
	out its own way: the title on top, the body and tags beside a box for the status and the author,
	whom the Theme's ReferencePicker chooses by name.

	Its form's `fields` are typed from the posts Resource, so TypeScript checks the inputs it
	renders itself, such as the title, and has none for a Field no form sets.
-->
<script lang="ts">
	import { isInputSpec, type FormInput, type FormInputSpec } from '@svelte-admin/core';
	import { createFormView } from '@svelte-admin/core/views';
	import {
		FieldInput,
		FieldIssues,
		FormActions,
		ReferencePicker
	} from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import { posts } from '#lib/resources/posts.ts';
	import * as remote from '#lib/resources/posts.remote.ts';

	const view = createFormView(admin, posts, remote, 'create');
	const { form } = view;

	// @ts-expect-error the backend counts a post's views, so the create form has no input for them
	void form.fields.viewCount;

	const specs = view.spec.filter(isInputSpec);
	/** The input spec of one of the Fields this View lays out through the Theme's `FieldInput`. */
	const specOf = (key: keyof FormInput<typeof posts, 'create'>): FormInputSpec => {
		const spec = specs.find((candidate) => candidate.key === key);
		if (spec === undefined) throw new Error(`The posts create form has no input for ${key}`);
		return spec;
	};

	const titleId = $props.id();
	const titleIssuesId = `${titleId}-issues`;
	const titleIssues = $derived(form.fields.title.issues());
</script>

<svelte:head>
	<title>New · {posts.label}</title>
</svelte:head>

<div class="flex max-w-4xl flex-col gap-5">
	<h1 class="text-2xl font-semibold tracking-tight">Write a post</h1>

	<form
		{...form}
		novalidate
		oninput={() => view.revalidate()}
		class="flex flex-col gap-5 rounded-lg border p-6"
	>
		{#if view.formIssues.length}
			<div
				role="alert"
				class="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
			>
				{#each view.formIssues as issue, index (index)}
					<p>{issue.message}</p>
				{/each}
			</div>
		{/if}

		<!-- The title, rendered from its typed input. -->
		<div class="flex flex-col gap-1.5">
			<label for={titleId} class="text-sm font-medium">
				Title <span aria-hidden="true" class="text-destructive">*</span>
			</label>
			<input
				{...form.fields.title.as('text')}
				id={titleId}
				placeholder="What is the post about?"
				aria-required="true"
				aria-describedby={titleIssues?.length ? titleIssuesId : undefined}
				class="h-11 w-full rounded-md border bg-background px-3 text-lg shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
			/>
			<FieldIssues id={titleIssuesId} issues={titleIssues} />
		</div>

		<div class="grid items-start gap-5 md:grid-cols-[1fr_16rem]">
			<div class="flex min-w-0 flex-col gap-5">
				<FieldInput spec={specOf('body')} field={form.fields.body} />
				<FieldInput spec={specOf('tags')} field={form.fields.tags} />
			</div>
			<aside aria-label="Publishing" class="flex flex-col gap-4 rounded-md border bg-muted/40 p-4">
				<FieldInput spec={specOf('status')} field={form.fields.status} />
				<!-- The author, a Reference to users, chosen by name with the Theme's picker. -->
				<ReferencePicker {admin} spec={specOf('userId')} field={form.fields.userId} />
			</aside>
		</div>

		<FormActions saving={view.saving} cancelHref={view.cancelHref} />
	</form>
</div>
