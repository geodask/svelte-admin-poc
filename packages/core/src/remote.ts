import type { FormInput } from './form-spec.ts';
import type { ListParams, ListResult } from './provider.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';

/**
 * What a remote query returns: a promise of its result that can also load it again. In the
 * browser `refresh` fetches it anew, e.g. for a Retry after a failure.
 */
export type RemoteRead<T> = Promise<T> & { refresh(): Promise<void> };

/** An issue a remote form reports: its message, and the path of the input it belongs to. */
export type RemoteFormIssue = { message: string; path: (string | number)[] };

/**
 * One input of a remote form, or a set of them (a list, a row or a group), as a Theme renders
 * it: `as(type)` gives the attributes to spread onto an input (its name, type, value and
 * `aria-invalid`), and `issues()` the issues that belong to it itself. A list's items and a
 * row's or group's Fields are read by index or key: `fields.tags[0]`,
 * `fields.ingredients[2].name`. (Kit's own type is stricter; this is the part the core relies
 * on.)
 */
export type RemoteFormField = {
	/** What the input, or set of inputs, will submit: an array for a list or rows. */
	value(): unknown;
	/** Replace what it will submit, e.g. a list without the item a × button removed. */
	set(value: unknown): unknown;
	issues(): RemoteFormIssue[] | undefined;
	/** The issues of the field and of every input inside it. */
	allIssues(): RemoteFormIssue[] | undefined;
	// Methods, so Kit's stricter, generic `as` fits them.
	as(type: RemoteFormInputType): Record<string, unknown>;
	/** A hidden input, which needs its value given, e.g. the edit form's record id. */
	as(type: 'hidden', value: string | number): Record<string, unknown>;
} & { readonly [key: string | number]: RemoteFormField };

/** The input types a Theme renders a form's Fields with. */
export type RemoteFormInputType =
	'text' | 'email' | 'url' | 'number' | 'checkbox' | 'select' | 'date' | 'datetime-local';

/**
 * A remote form, as the core's helpers and a Theme use it: spread it onto a `<form>`, read its
 * inputs from `fields`, and watch `pending` while a submit is in flight.
 */
export type RemoteFormLike = {
	readonly method: 'POST';
	readonly action: string;
	readonly pending: number;
	/** Whether the form has been submitted at least once. */
	readonly submitted: boolean;
	readonly fields: { readonly [key: string]: RemoteFormField } & {
		allIssues(): RemoteFormIssue[] | undefined;
		/**
		 * Set every input's value, e.g. the edit form's prefill. Kit leaves a submitted form's
		 * input alone, so a failed save keeps what the user typed.
		 */
		set(values: FormInput): void;
	};
	/** Check the input in the browser with `schema` before it is sent. */
	preflight(schema: StandardSchemaV1<FormInput, unknown>): RemoteFormLike;
	/** Check the input again now, e.g. as the user edits after a failed submit. */
	validate(options?: { preflightOnly?: boolean }): Promise<void>;
};

/**
 * A Resource's remote functions, as its `.remote.ts` module exports them. `serveResource`
 * builds them on the server; in the browser the same imports are `fetch` wrappers. A remote
 * query is a promise of its result with a `refresh`, and a remote form an object to spread onto
 * a `<form>`, which is all the shared entry relies on, so it needs nothing from `$app/server`,
 * not even types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any record and id type fit by default
export type ResourceRemote<T = any, Id = any> = {
	getList: (params: ListParams) => RemoteRead<ListResult<T>>;
	getOne: (id: Id) => RemoteRead<T>;
	/** The create form: it saves a new record and redirects to its detail View. */
	create: RemoteFormLike;
	/**
	 * The edit form, one instance per record: `update.for(id)`. It saves the record's editable
	 * Fields and redirects to its detail View.
	 */
	update: RemoteFormLike & { for(id: Id): RemoteFormLike };
};
