import { page } from '$app/state';
import type { Admin } from './admin.ts';
import {
	formSchema,
	isInputSpec,
	toFormSpec,
	toFormValues,
	type FormFieldSpec,
	type FormMode
} from './form-spec.ts';
import { createReferencePicker, type ReferencePicker } from './reference-picker.ts';
import { listPathOfCreateView, listPathOfEditView, recordPath } from './ids.ts';
import { recordTitle } from './record-title.ts';
import type {
	RemoteFormFields,
	RemoteFormIssue,
	RemoteFormLike,
	RemoteRead,
	ResourceRemote
} from './remote.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/**
 * The headless create or edit View: the Resource's remote form, the inputs to render (the form
 * spec), and where Cancel leads. On edit it also gives the record's query, its Record title,
 * the prefill, and the record's id for the form's hidden input. The Theme's create and edit
 * Views are built on it, and so can a replaced View. It takes the admin from `admin.ts` and the
 * Resource as arguments, not from context.
 *
 * The form checks its input in the browser before sending it, with the same schema the server
 * validates with, so issues show at once. Issues show only after the first submit attempt;
 * call `revalidate` as the user edits (e.g. from the form's `oninput`) so they then follow
 * what is typed.
 *
 * Without JavaScript the form posts to the page, which the server renders again with the
 * issues and what was typed, or redirects to the record's detail View.
 *
 * On edit, the id must already be the Resource's typed id: a route turns its param into one
 * with `idFromParam` and answers a param that names none with a 404. Render the form only once
 * the record has loaded, and call `prefill(record)` once, during render, before the inputs:
 * it fills them with the record's values, on the server too, and Kit skips it after a failed
 * submit, so the user's input survives.
 *
 * `form` keeps the type of the remote form passed in, so a View that replaces the create or edit
 * View gets `form.fields` typed from the Resource (`FormInput`): `form.fields.name` is checked,
 * and a Field no form sets has no input there. `inputs` holds the same inputs untyped, for
 * parts that render any Field, such as the Theme's `FieldInput`.
 *
 * @example
 * const view = createFormView(admin, users, remote, 'create');
 * // <form {...view.form} novalidate oninput={view.revalidate}>
 * //   <input {...view.form.fields.name.as('text')} />
 *
 * @example
 * const view = createFormView(admin, users, remote, 'edit', id);
 * const record = $derived(await view.query);
 * view.prefill(record);
 * // <form {...view.form} novalidate oninput={view.revalidate}>
 * //   <input {...view.form.fields.id.as('hidden', view.id)} />
 */
export function createFormView<
	R extends Resource,
	Remote extends ResourceRemote<RecordOf<R>, IdOf<R>>
>(
	admin: Admin,
	resource: R,
	remote: Remote,
	mode: 'create'
): FormView<R, 'create', Remote['create']>;
export function createFormView<
	R extends Resource,
	Remote extends ResourceRemote<RecordOf<R>, IdOf<R>>
>(
	admin: Admin,
	resource: R,
	remote: Remote,
	mode: 'edit',
	id: IdOf<R>
): FormView<R, 'edit', ReturnType<Remote['update']['for']>>;
export function createFormView<R extends Resource>(
	// How the form View reaches the admin's other Resources: a Reference's target.
	admin: Admin,
	resource: R,
	remote: ResourceRemote<RecordOf<R>, IdOf<R>>,
	mode: FormMode,
	id?: IdOf<R>
): FormView<R, FormMode> {
	if (mode === 'edit' && id === undefined) throw new Error('An edit View needs the record id');
	const editing = mode === 'edit' && id !== undefined;
	// The create View sits at `{list}/new` and the edit View at `{list}/{id}/edit`, so the
	// list's path carries the base path.
	const listViewHref = $derived(
		(editing ? listPathOfEditView : listPathOfCreateView)(page.url.pathname) ?? page.url.pathname
	);
	const detailViewHref = $derived(editing ? recordPath(listViewHref, id) : undefined);
	const instance = editing ? remote.update.for(id) : remote.create;
	const form: RemoteFormLike = instance.preflight(formSchema(resource, mode));
	const spec: readonly FormFieldSpec[] = toFormSpec(resource, mode);

	return {
		resource,
		mode,
		/**
		 * The admin from `admin.ts`, which the Theme's parts take to pick a Reference and to show a
		 * read-only one by its Record title.
		 */
		admin,
		/** The record's id, for the edit form's hidden `id` input. `undefined` on create. */
		id: editing ? id : undefined,
		/**
		 * The remote form: spread it onto the `<form>`, and read each input from `form.fields`,
		 * typed from the Resource when the remote form is.
		 */
		form,
		/**
		 * The form's inputs by key, untyped: the same as `form.fields`, for parts that render any
		 * Field (`<FieldInput {spec} field={view.inputs[spec.key]} />`) and the edit form's hidden
		 * `id` input.
		 */
		inputs: form.fields as RemoteFormFields,
		/** The inputs to render, one per Field the form maps, in schema order. */
		spec,
		/** The record being edited. Await it: `$derived(await view.query)`. Only on edit. */
		get query(): RemoteRead<RecordOf<R>> {
			if (!editing) throw new Error('A create View has no record to load');
			return remote.getOne(id);
		},
		/**
		 * Load the record again, from the server. A Retry after a failure calls it before
		 * rendering the form again, since a failed read otherwise stays failed.
		 */
		refresh(): Promise<void> {
			return editing ? remote.getOne(id).refresh() : Promise.resolve();
		},
		/**
		 * The headless picker of a Reference input, by its key: its target, its current choice's
		 * Record title, the options of a `<select>` without JavaScript and `search` for a combobox
		 * (see `createReferencePicker`). Its current choice is what the input holds now. It throws
		 * for a key the form has no Reference input for.
		 */
		picker(key: string): ReferencePicker {
			const input = spec.filter(isInputSpec).find((candidate) => candidate.key === key);
			if (input?.kind !== 'reference') {
				throw new Error(`The ${resource.name} form has no Reference input for "${key}"`);
			}
			return createReferencePicker(admin, input, (form.fields as RemoteFormFields)[key].value());
		},
		/** The text that names the record, e.g. for the edit View's heading. */
		title(record: RecordOf<R>): string {
			return recordTitle(resource, record);
		},
		/**
		 * Fill the inputs with a record's values. Call it once, during render, before the
		 * inputs: Kit skips it after a failed submit, so what the user typed stays.
		 */
		prefill(record: RecordOf<R>): void {
			form.fields.set(toFormValues(spec, record));
		},
		/** The href of the Resource's list View. */
		get listViewHref(): string {
			return listViewHref;
		},
		/** Where Cancel leads: the list View on create, the record's detail View on edit. */
		get cancelHref(): string {
			return detailViewHref ?? listViewHref;
		},
		/**
		 * The issues of the form as a whole, to show above its Fields: why the Provider refused
		 * the last save when no input is to blame (e.g. a conflict, or "This record no longer
		 * exists" on edit). Empty when there are none.
		 */
		get formIssues(): RemoteFormIssue[] {
			return form.fields.issues() ?? [];
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

/**
 * What `createFormView` returns, for a Resource, a mode and the type of its remote form: Kit's
 * typed form for an app's own remote functions, or the untyped `RemoteFormLike`.
 */
export type FormView<R extends Resource, M extends FormMode, F = RemoteFormLike> = {
	readonly resource: R;
	readonly mode: M;
	readonly admin: Admin;
	readonly id: IdOf<R> | undefined;
	readonly form: F;
	readonly inputs: RemoteFormFields;
	readonly spec: readonly FormFieldSpec[];
	readonly query: RemoteRead<RecordOf<R>>;
	refresh(): Promise<void>;
	picker(key: string): ReferencePicker;
	title(record: RecordOf<R>): string;
	prefill(record: RecordOf<R>): void;
	readonly listViewHref: string;
	readonly cancelHref: string;
	readonly formIssues: RemoteFormIssue[];
	readonly saving: boolean;
	revalidate(): void;
};

/** What `createFormView` returns, untyped: what the Theme's create and edit Views work with. */
export type FormViewState<R extends Resource = Resource> = FormView<R, FormMode>;
