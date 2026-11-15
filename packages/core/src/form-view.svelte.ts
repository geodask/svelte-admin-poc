import { page } from '$app/state';
import { formSchema, toFormSpec, type FormFieldSpec, type FormMode } from './form-spec.ts';
import { CREATE_SEGMENT } from './ids.ts';
import type { RemoteFormLike, ResourceRemote } from './remote.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/**
 * The headless create View: the Resource's remote form, the inputs to render (the form spec),
 * and where Cancel leads. The Theme's create View is built on it, and so can a replaced View. It
 * takes the Resource as an argument, not from context.
 *
 * The form checks its input in the browser before sending it, with the same schema the server
 * validates with, so issues show at once. Issues show only after the first submit attempt;
 * call `revalidate` as the user edits (e.g. from the form's `oninput`) so they then follow
 * what is typed.
 *
 * Without JavaScript the form posts to the page, which the server renders again with the
 * issues and what was typed, or redirects to the new record's detail View.
 *
 * @example
 * const view = createFormView(users, remote, 'create');
 * // <form {...view.form} novalidate oninput={view.revalidate}>
 */
export function createFormView<R extends Resource>(
	resource: R,
	remote: ResourceRemote<RecordOf<R>, IdOf<R>>,
	mode: FormMode
) {
	// The create View sits at `{list}/new`, so the list's path carries the base path.
	const listViewHref = $derived(page.url.pathname.replace(new RegExp(`/${CREATE_SEGMENT}$`), ''));
	const form: RemoteFormLike = remote.create.preflight(formSchema(resource, mode));
	const spec: readonly FormFieldSpec[] = toFormSpec(resource, mode);

	return {
		resource,
		mode,
		/** The remote form: spread it onto the `<form>`, and read each input from `form.fields`. */
		form,
		/** The inputs to render, one per Field the form maps, in schema order. */
		spec,
		/** Where Cancel leads: the Resource's list View. */
		get cancelHref(): string {
			return listViewHref;
		},
		/** Whether a submit is in flight, so Save can show progress and be disabled. */
		get saving(): boolean {
			return form.pending > 0;
		},
		/**
		 * Check the input again in the browser, once the form has been submitted, so its issues
		 * follow what the user types. Before the first submit it does nothing, so the form never
		 * scolds while it is first filled in.
		 */
		revalidate(): void {
			if (form.submitted) void form.validate({ preflightOnly: true });
		}
	};
}

/** What `createFormView` returns. */
export type FormViewState<R extends Resource = Resource> = ReturnType<typeof createFormView<R>>;
